const fs = require('fs');
const readline = require('readline')

async function getJSON() {
    const rl = readline.createInterface({
        input: fs.createReadStream('./skills.txt'),
    })

    console.log('--- generating json')

    const items = new Map();
    const stack = [];
    for await (const l of rl) {
        const trimmed = l.trim();
        if (trimmed.length == 0 || trimmed.charAt(0) == '#')
            continue;
        const lg = l.match(/^(\s*)([^:]*):*\s*(\d*)\s*$/)
        if (!lg)
            throw new Error('Invalid row: ' + l);
        const depth = lg[1].length;
        const name = lg[2].trim();
        let level = (lg.length == 4 && lg[3].length > 0 ? parseInt(lg[3]) : 0);
        const record = {
            name,
            depth,
            level
        }
        {
            const lname = name.toLowerCase();
            if (items.has(lname))
                items.get(lname).push(record);
            else
                items.set(lname, [record]);
        }
        const last = stack.pop();
        if (!last) {
            stack.push(record);
        } else if (depth > last.depth) { //child
            if (!last.children)
                last.children = [];
            last.children.push(record);
            last.level = Math.max(last.level, level);
            stack.push(last);
            stack.push(record);
        } else if (depth == last.depth) { //sibling
            const parent = stack.pop();
            parent.children.push(record);
            parent.level = Math.max(parent.level, level);
            stack.push(parent);
            stack.push(record);
        } else { //
            let parent;
            do {
                parent = stack.pop();
                parent.level = level = Math.max(parent.level, level);
            } while (parent.depth > depth)

            //sibling
            parent = stack.pop();
            parent.children.push(record);
            parent.level = Math.max(parent.level, level);
            stack.push(parent);
            stack.push(record);
        }
    }

    for (const r of items.values()) {
        if (r.length == 1)
            continue;
        let last;
        for (const o of r) {
            if (last && last.name !== o.name) {
                console.error('warning: Different case for ' + last.name + ' and ' + o.name);
                break;
            }
            if (last && last.level && o.level && last.level !== o.level) {
                console.log('warning: Different levels for ' + o.name);
                break;
            }
            last = o;
        }

    }

    const data = stack.shift();
    return JSON.stringify(data);
}

(async () => {
    const json = await getJSON();
    fs.writeFileSync('./skills.json', json);
})();
