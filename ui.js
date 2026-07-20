"use strict";
// Global System States
let ignoredDomains = new Set();
const createNode = (name) => ({
    name,
    count: 0,
    firstVisit: Infinity,
    lastVisit: 0,
    children: new Map()
});
const updateNodeStats = (node, visitTimes) => {
    node.count += visitTimes.length;
    node.firstVisit = Math.min(node.firstVisit, ...visitTimes);
    node.lastVisit = Math.max(node.lastVisit, ...visitTimes);
};
// Data Harvester and Processor Pipeline
async function getAggregatedHistory(startTime, endTime, ignored) {
    const results = await chrome.history.search({
        text: '',
        startTime: startTime,
        endTime: endTime,
        maxResults: 15000 // Large scale capture safety ceiling
    });
    const rootNodes = new Map();
    // Concurrently fetch structural paths via multi-threaded Promise queues
    const fetchPromises = results.map(async (item) => {
        if (!item.url)
            return;
        try {
            const url = new URL(item.url);
            const domain = url.hostname;
            if (ignored.has(domain))
                return;
            const visits = await chrome.history.getVisits({ url: item.url });
            const validVisitTimes = visits
                .map(v => v.visitTime || 0)
                .filter(time => time >= startTime && time <= endTime);
            if (validVisitTimes.length === 0)
                return;
            // Tier 1: Domain Mapping Nodes
            if (!rootNodes.has(domain))
                rootNodes.set(domain, createNode(domain));
            const domainNode = rootNodes.get(domain);
            updateNodeStats(domainNode, validVisitTimes);
            // Tier 2: Path Sub-Trees
            const path = url.pathname === '/' ? '/' : url.pathname;
            if (!domainNode.children.has(path))
                domainNode.children.set(path, createNode(path));
            const pathNode = domainNode.children.get(path);
            updateNodeStats(pathNode, validVisitTimes);
            // Tier 3: Query Parameter Leaf Arrays
            if (url.search) {
                const query = url.search;
                if (!pathNode.children.has(query))
                    pathNode.children.set(query, createNode(query));
                const queryNode = pathNode.children.get(query);
                updateNodeStats(queryNode, validVisitTimes);
            }
        }
        catch (e) {
            // Discard specific edge cases like configuration loops (chrome://)
        }
    });
    await Promise.all(fetchPromises);
    return rootNodes;
}
// Component Recursive Engine Render Matrix
function createRowElement(node, depth = 0) {
    const hasChildren = node.children.size > 0;
    const container = document.createElement(hasChildren ? 'details' : 'div');
    const row = document.createElement(hasChildren ? 'summary' : 'div');
    row.className = `grid-row ${hasChildren ? 'tree-row' : 'leaf-node'}`;
    row.style.paddingLeft = `${depth * 20}px`;
    const formatDate = (ts) => {
        if (ts === Infinity || ts === 0)
            return '-';
        return new Intl.DateTimeFormat('default', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        }).format(new Date(ts));
    };
    row.innerHTML = `
    <div class="col-name" title="${node.name}">${node.name}</div>
    <div class="col-stats">${node.count}</div>
    <div class="col-stats">${formatDate(node.firstVisit)}</div>
    <div class="col-stats">${formatDate(node.lastVisit)}</div>
  `;
    container.appendChild(row);
    if (hasChildren) {
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'tree-children';
        const sortedChildren = Array.from(node.children.values())
            .sort((a, b) => b.count - a.count);
        for (const childNode of sortedChildren) {
            childrenContainer.appendChild(createRowElement(childNode, depth + 1));
        }
        container.appendChild(childrenContainer);
    }
    return container;
}
// Master DOM Assembler Orchestration
async function renderHistoryTree() {
    const rootElement = document.getElementById('tree-root');
    if (!rootElement)
        return;
    rootElement.innerHTML = '<em>Processing system parameters and fetching local histories...</em>';
    const { startTime, endTime } = getTimeBounds();
    const historyMap = await getAggregatedHistory(startTime, endTime, ignoredDomains);
    rootElement.innerHTML = '';
    if (historyMap.size === 0) {
        rootElement.innerHTML = '<em>No history components tracked within the parsed boundary boundaries.</em>';
        return;
    }
    const sortedDomains = Array.from(historyMap.values()).sort((a, b) => b.count - a.count);
    for (const domainNode of sortedDomains) {
        rootElement.appendChild(createRowElement(domainNode, 0));
    }
}
// Timeline Filter Constraints Engine
function getTimeBounds() {
    const preset = document.getElementById('time-preset').value;
    const now = Date.now();
    let startTime = 0;
    let endTime = now;
    const ONE_DAY = 24 * 60 * 60 * 1000;
    switch (preset) {
        case '1w':
            startTime = now - (7 * ONE_DAY);
            break;
        case '1m':
            startTime = now - (30 * ONE_DAY);
            break;
        case '3m':
            startTime = now - (90 * ONE_DAY);
            break;
        case 'custom':
            const startInput = document.getElementById('date-start').value;
            const endInput = document.getElementById('date-end').value;
            if (startInput)
                startTime = new Date(`${startInput}T00:00:00`).getTime();
            if (endInput)
                endTime = new Date(`${endInput}T23:59:59`).getTime();
            break;
    }
    return { startTime, endTime };
}
// Application Navigation and Sync System Management
function setupTabs() {
    const btnHistory = document.getElementById('btn-tab-history');
    const btnSettings = document.getElementById('btn-tab-settings');
    const viewHistory = document.getElementById('view-history');
    const viewSettings = document.getElementById('view-settings');
    const toggleViews = (showHistory) => {
        btnHistory.classList.toggle('active', showHistory);
        viewHistory.classList.toggle('active', showHistory);
        btnSettings.classList.toggle('active', !showHistory);
        viewSettings.classList.toggle('active', !showHistory);
        if (showHistory)
            renderHistoryTree();
    };
    btnHistory.addEventListener('click', () => toggleViews(true));
    btnSettings.addEventListener('click', () => toggleViews(false));
}
// Persistent Storage Management Subroutines
async function loadIgnoredDomains() {
    const data = await chrome.storage.local.get({ ignoredDomains: [] });
    // Add 'as string[]' right here:
    ignoredDomains = new Set(data.ignoredDomains);
}
async function saveIgnoredDomains() {
    await chrome.storage.local.set({ ignoredDomains: Array.from(ignoredDomains) });
}
function renderSettings() {
    const list = document.getElementById('ignored-domains-list');
    list.innerHTML = '';
    Array.from(ignoredDomains).sort().forEach(domain => {
        const li = document.createElement('li');
        li.textContent = domain;
        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'Remove';
        removeBtn.className = 'btn-remove';
        removeBtn.onclick = async () => {
            ignoredDomains.delete(domain);
            await saveIgnoredDomains();
            renderSettings();
        };
        li.appendChild(removeBtn);
        list.appendChild(li);
    });
}
// Initial Bootstrapper Setup
document.addEventListener('DOMContentLoaded', async () => {
    const presetSelect = document.getElementById('time-preset');
    const customGroup = document.getElementById('custom-date-group');
    const refreshBtn = document.getElementById('btn-refresh');
    const form = document.getElementById('add-domain-form');
    await loadIgnoredDomains();
    setupTabs();
    renderSettings();
    presetSelect.addEventListener('change', () => {
        customGroup.classList.toggle('hidden', presetSelect.value !== 'custom');
    });
    refreshBtn.addEventListener('click', renderHistoryTree);
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('new-domain-input');
        const cleanDomain = input.value.trim().toLowerCase();
        if (cleanDomain && !ignoredDomains.has(cleanDomain)) {
            ignoredDomains.add(cleanDomain);
            await saveIgnoredDomains();
            input.value = '';
            renderSettings();
        }
    });
    renderHistoryTree();
});
