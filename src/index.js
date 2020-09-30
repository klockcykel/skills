const Hammer = require('hammerjs');
const svgPanZoom = require('svg-pan-zoom');
const d3 = require('d3');

import './style.css'
const data = require('../skills.json')

let lastWidth;
let lastHeight;
let resizeDeBounce;
let searchData;
let lastSearch;
let zoom;
let zoomedElement;
let debounceZoom;

function zoomConditionally(resize) {
    if (debounceZoom)
        clearTimeout(debounceZoom);

    if (resize) {
        debounceZoom = setTimeout(() => {
            location = location;
        }, 200);
        return;
    }

    debounceZoom = setTimeout(() => {
        zoom.fit();
        zoom.center();
        if (!zoomedElement) {
            debounceZoom = undefined;
            return;
        }
        debounceZoom = setTimeout(() => {
            if (zoomedElement) {
                const bbox = zoomedElement.getBoundingClientRect();
                if (bbox.y > 2 / 3 * lastHeight) {
                    bbox.y *= 1.1;
                }
                zoom.zoomAtPoint(6, { x: bbox.x, y: bbox.y })
            }
            debounceZoom = undefined;
        }, 300)
    }, 300)
}

function highlight() {
    if (!searchData)
        return;
    const search = document.getElementById('searchinput');
    let q = search.value.replace(/\s/g, '').toLowerCase();
    let fullQ = search.value.trim().toLowerCase();
    if (q !== lastSearch) {
        let firstHit;
        let result = new Set();
        let fullMatch;
        for (const d of searchData) {
            if (q.length && d.str.indexOf(q) != -1) {
                const el = document.getElementById('node' + d.id);
                if (!firstHit)
                    firstHit = el
                el.classList.add('highlighted');
                document.getElementById('dot' + d.id).classList.add('dothigh');
                if (d.name.toLowerCase() === fullQ) {
                    fullMatch = firstHit = el;
                }
                result.add(d.name);
            } else {
                document.getElementById('node' + d.id).classList.remove('highlighted');
                document.getElementById('dot' + d.id).classList.remove('dothigh');
            }
        }
        const el = document.getElementById('searchresult');
        if (result.size > 0) {
            const values = Array.from(result.values());
            while (el.firstChild)
                el.removeChild(el.firstChild);
            if (result.size > 1 || !fullMatch) {
                for (const d of values) {
                    const de = document.createElement('div');
                    de.append(d);
                    el.appendChild(de);
                }
                el.onclick = (e) => {
                    if (!e.target)
                        return;

                    if (!e.target.textContent)
                        return;

                    document.getElementById('searchinput').value = e.target.textContent;
                    highlight();
                }
                if (result.size > 15) {
                    const fader = document.createElement('div');
                    fader.classList.add('searchresultfade');
                    el.appendChild(fader);
                }
            }
        } else if (q.length) {
            el.innerHTML = '<i>Not found</i>'
        } else {
            el.innerText = ''
        }

        zoomedElement = firstHit;
        zoomConditionally();

        lastSearch = q;
    }
}

function initZoom(svgNode) {
    const eventsHandler = {
        haltEventListeners: ['touchstart', 'touchend', 'touchmove', 'touchleave', 'touchcancel']
        , init: function (options) {
            var instance = options.instance
                , initialScale = 1
                , pannedX = 0
                , pannedY = 0

            // Init Hammer
            // Listen only for pointer and touch events
            this.hammer = Hammer(options.svgElement, {
                inputClass: Hammer.SUPPORT_POINTER_EVENTS ? Hammer.PointerEventInput : Hammer.TouchInput
            })

            // Enable pinch
            this.hammer.get('pinch').set({ enable: true })

            // Handle double tap
            this.hammer.on('doubletap', function (ev) {
                instance.zoomIn()
            })

            // Handle pan
            this.hammer.on('panstart panmove', function (ev) {
                // On pan start reset panned variables
                if (ev.type === 'panstart') {
                    pannedX = 0
                    pannedY = 0
                }

                // Pan only the difference
                instance.panBy({ x: ev.deltaX - pannedX, y: ev.deltaY - pannedY })
                pannedX = ev.deltaX
                pannedY = ev.deltaY
            })

            // Handle pinch
            this.hammer.on('pinchstart pinchmove', function (ev) {
                // On pinch start remember initial zoom
                if (ev.type === 'pinchstart') {
                    initialScale = instance.getZoom()
                    instance.zoomAtPoint(initialScale * ev.scale, { x: ev.center.x, y: ev.center.y })
                }

                instance.zoomAtPoint(initialScale * ev.scale, { x: ev.center.x, y: ev.center.y })
            })

            // Prevent moving the page on some devices when panning over SVG
            options.svgElement.addEventListener('touchmove', function (e) { e.preventDefault(); });
        }

        , destroy: function () {
            this.hammer.destroy()
        }
    }

    zoom = svgPanZoom(svgNode, {
        customEventsHandler: eventsHandler
    })
    zoom.setZoomScaleSensitivity(1.1);

    document.getElementById('zoomIn').addEventListener('click', () => {
        zoom.zoomIn();
    });
    document.getElementById('zoomOut').addEventListener('click', () => {
        zoom.zoomOut();
    });
}

async function init() {
    const width = 3000;
    const height = 3000;
    lastWidth = document.body.clientWidth;
    lastHeight = document.body.clientHeight

    const setId = (d, id) => {
        d.id = id;
        if (!d.children)
            return id;
        for (const child of d.children) {
            id = setId(child, id + 1)
        }
        return id;
    }
    setId(data, 0);

    const d3data = d3.hierarchy(data)
        .sort((a, b) => d3.ascending(a.data.name, b.data.name))

    const tree = d3.tree()
        .size([2 * Math.PI, height / 2.5])
        .separation((a, b) => (a.parent == b.parent ? 1 : 2) / a.depth)

    const root = tree(d3data);

    const svg = d3.select('#graph')
        .attr('width', width).attr('height', height)
        .attr('viewBox', [-width / 2, -height / 2, width, height])
    //.attr('viewBox', [0, 0, width, height])

    svg.append('g')
        .attr('fill', 'none')
        .attr('stroke-opacity', 0.4)
        .attr('stroke-width', 1.5)
        .selectAll('path')
        .data(root.links())
        .join('path')
        .attr('stroke', (d) => {
            if (!d.source.data.depth)
                return 'rgba(0,0,0,0)'
            return '#555'
        })
        .attr('d', d3.linkRadial()
            .angle(d => d.x)
            .radius(d => d.y));

    svg.append('g')
        .selectAll('circle')
        .data(root.descendants())
        .join('circle')
        .attr('transform', d => `
        rotate(${d.x * 180 / Math.PI - 90})
        translate(${d.y},0)
      `)
        .attr('fill', (d) => {
            if (!d.data.depth)
                return 'rgba(0,0,0,0)'
            return d.children ? '#555' : '#999'
        })
        .attr('id', (d) => 'dot' + d.data.id)
        .attr('r', 2.5);

    searchData = [];
    svg.append('g')
        //        .attr('font-family', 'sans-serif')
        .attr('stroke-linejoin', 'round')
        .attr('stroke-width', 3)
        .selectAll('text')
        .data(root.descendants())
        .join('text')
        .attr('transform', d => `
        rotate(${d.x * 180 / Math.PI - 90}) 
        translate(${d.y},0) 
        rotate(${d.x >= Math.PI ? 180 : 0})
      `)
        .attr('dy', '0.31em')
        .attr('x', d => d.x < Math.PI === !d.children ? 6 : -6)
        .attr('text-anchor', d => d.x < Math.PI === !d.children ? 'start' : 'end')
        .attr('font-size', (d) => {
            if (!d.data.depth)
                return 40;
            return Math.round(30 / Math.log(d.data.depth));
        })
        .attr('class', 'label')
        .attr('fill', (d) => {
            if (!d.data.depth)
                return 'rgba(0,0,0,0)';
            const level = Math.min(0xDD, Math.min(0xFF, Math.round(3 * 0xFF / (d.data.level ? d.data.level : 10))));
            return `rgb(${level},${level},${level})`;

        })
        .attr('id', (d) => {
            if (!d.data.id) //skip root node
                return 'rootNode';
            const so = {
                id: d.data.id,
                name: d.data.name,
                str: d.data.name.replace(/\s/g, '').toLowerCase(),
            }
            searchData.push(so);
            return 'node' + so.id;
        })
        .text(d => d.data.name)


    initZoom(svg.node());

    searchData = searchData.sort((a, b) => a.name.localeCompare(b.name));

    document.getElementById('search').addEventListener('input', highlight)
    highlight();
}

/**
 * Pinch
 * Recognized when two or more pointers are moving toward (zoom-in) or away from each other (zoom-out).
 * @constructor
 * @extends AttrRecognizer
 */
function PinchRecognizer() {
    AttrRecognizer.apply(this, arguments);
}

window.onload = init
const UA = navigator.userAgent;
if (!/mobile/i.test(UA))
    window.addEventListener('resize', () => { zoomConditionally(true) });

