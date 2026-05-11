const API_BASE_URL = 'http://localhost:5000';
let currentAggregationType = 'average';
let charts = {};
let lastForecastData = null;

// ===== Sample Data (Fallback) =====
const SAMPLE_DATA = {
    dates: [
        '2010-02-05', '2010-02-12', '2010-02-19', '2010-02-26', '2010-03-05',
        '2010-03-12', '2010-03-19', '2010-03-26', '2010-04-02', '2010-04-09', '2010-04-16'
    ],
    sales: [
        1643690.9, 1641957.44, 1611968.17, 1409727.59, 1554806.68,
        1439541.59, 1472515.79, 1404429.92, 1594968.28, 1545418.53, 1466058.28
    ]
};

// ===== Chart.js Global Configuration =====
Chart.defaults.color = '#94a3b8';
Chart.defaults.font.family = "'Segoe UI', system-ui, sans-serif";
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.padding = 20;

// ===== Utility Functions =====
function showLoading() {
    document.getElementById('loadingOverlay').classList.add('active');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('active');
}

function showToast(message) {
    const toast = document.getElementById('errorToast');
    document.getElementById('toastMessage').textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 5000);
}

function hideToast() {
    document.getElementById('errorToast').classList.remove('show');
}

function formatCurrency(value) {
    if (value >= 1000000) return '$' + (value / 1000000).toFixed(2) + 'M';
    if (value >= 1000) return '$' + (value / 1000).toFixed(1) + 'K';
    return '$' + value.toFixed(2);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ===== Tab Switching =====
function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.tab === tabName) tab.classList.add('active');
    });

    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');

    loadTabData(tabName);
}

// ===== Aggregation Toggle =====
function setAggregationType(type) {
    currentAggregationType = type;

    document.getElementById('avgBtn').classList.toggle('active', type === 'average');
    document.getElementById('totalBtn').classList.toggle('active', type === 'total');

    const titleEl = document.getElementById('salesChartTitle');
    const noteEl = document.getElementById('overviewNote');

    if (type === 'average') {
        titleEl.textContent = 'Average Weekly Sales Across Stores';
        noteEl.textContent = 'Each point represents the average sales across all stores for that date.';
    } else {
        titleEl.textContent = 'Total Weekly Sales Across All Stores';
        noteEl.textContent = 'Each point represents the sum of sales from all stores for that date.';
    }

    loadAllData();
}

// ===== Use Sample Data =====
function useSampleData() {
    showLoading();
    setTimeout(() => {
        const sampleForecast = generateSampleForecast(SAMPLE_DATA);

        renderSalesChart(SAMPLE_DATA);
        updateStats(SAMPLE_DATA.sales);
        renderMovingAvgChart({
            dates: SAMPLE_DATA.dates,
            sales: SAMPLE_DATA.sales,
            moving_average: calculateMovingAverage(SAMPLE_DATA.sales, 4)
        });
        renderHistogramChart(generateHistogramData(SAMPLE_DATA.sales));
        renderForecastCharts(sampleForecast);
        updateMAETable({
            mae_arima: null,
            mae_hw: null,
            mae_lstm: null
        });

        hideLoading();
        showToast('Loaded sample data successfully');
    }, 500);
}

// ===== Helper: Moving Average =====
function calculateMovingAverage(data, window) {
    return data.map((_, i) => {
        if (i < window - 1) return null;
        const slice = data.slice(i - window + 1, i + 1);
        return slice.reduce((a, b) => a + b, 0) / window;
    });
}

// ===== Helper: Histogram =====
function generateHistogramData(sales) {
    const min = Math.min(...sales);
    const max = Math.max(...sales);
    const binCount = 10;
    const binWidth = (max - min) / binCount;
    const bins = [], counts = [];

    for (let i = 0; i < binCount; i++) {
        const start = min + i * binWidth;
        const end = start + binWidth;
        bins.push(`${(start / 1000000).toFixed(1)}M-${(end / 1000000).toFixed(1)}M`);
        counts.push(sales.filter(s => s >= start && s < end).length);
    }
    return { bins, counts };
}

// ===== Helper: Sample Forecast (includes LSTM) =====
function generateSampleForecast(data) {
    const lastDate = new Date(data.dates[data.dates.length - 1]);
    const forecastDates = [];
    const baseValue = data.sales[data.sales.length - 1];

    for (let i = 1; i <= 10; i++) {
        const d = new Date(lastDate);
        d.setDate(d.getDate() + i * 7);
        forecastDates.push(d.toISOString().split('T')[0]);
    }

    const arima = forecastDates.map((_, i) =>
        baseValue * (1 + 0.02 * i + (Math.random() - 0.5) * 0.1)
    );
    const hw = forecastDates.map((_, i) =>
        baseValue * (1 + 0.015 * i + (Math.random() - 0.5) * 0.08)
    );
    const lstm = forecastDates.map((_, i) =>
        baseValue * (1 + 0.018 * i + (Math.random() - 0.5) * 0.07)
    );

    return {
        historical_dates: data.dates,
        historical_sales: data.sales,
        forecast_dates: forecastDates,
        arima_forecast: arima,
        holt_winters_forecast: hw,
        lstm_forecast: lstm,
        mae_arima: null,
        mae_hw: null,
        mae_lstm: null
    };
}

// ===== API Helper =====
async function fetchData(endpoint) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
}

// ===== Load Functions =====
async function loadSalesData() {
    try {
        const result = await fetchData(`/data?type=${currentAggregationType}`);
        if (result.success) {
            renderSalesChart(result.data);
            updateStats(result.data.sales);
        }
    } catch {
        renderSalesChart(SAMPLE_DATA);
        updateStats(SAMPLE_DATA.sales);
    }
}

async function loadMovingAverageData() {
    try {
        const result = await fetchData(`/moving-average?type=${currentAggregationType}&window=4`);
        if (result.success) renderMovingAvgChart(result.data);
    } catch {
        renderMovingAvgChart({
            dates: SAMPLE_DATA.dates,
            sales: SAMPLE_DATA.sales,
            moving_average: calculateMovingAverage(SAMPLE_DATA.sales, 4)
        });
    }
}

async function loadHistogramData() {
    try {
        const result = await fetchData('/histogram');
        if (result.success) renderHistogramChart(result.data);
    } catch {
        renderHistogramChart(generateHistogramData(SAMPLE_DATA.sales));
    }
}

async function loadForecastData() {
    try {
        const result = await fetchData(`/forecast?type=${currentAggregationType}&steps=10`);
        if (result.success) {
            lastForecastData = result.data;
            renderForecastCharts(result.data);
            updateMAETable(result.data);
        }
    } catch {
        const fallback = generateSampleForecast(SAMPLE_DATA);
        lastForecastData = fallback;
        renderForecastCharts(fallback);
        updateMAETable(fallback);
    }
}

// ===== Tab Data Loader =====
async function loadTabData(tabName) {
    showLoading();
    try {
        switch (tabName) {
            case 'overview':
                await loadSalesData();
                break;
            case 'analysis':
                await Promise.all([loadMovingAverageData(), loadHistogramData()]);
                break;
            case 'forecast':
                await loadForecastData();
                break;
            case 'comparison':
                // Reuse cached data if available, else fetch
                if (lastForecastData) {
                    renderComparisonChart(lastForecastData);
                    updateMAETable(lastForecastData);
                } else {
                    await loadForecastData();
                }
                break;
        }
    } catch {
        showToast('Failed to load data. Using sample data.');
    } finally {
        hideLoading();
    }
}

async function loadAllData() {
    showLoading();
    try {
        await Promise.all([
            loadSalesData(),
            loadMovingAverageData(),
            loadHistogramData(),
            loadForecastData()
        ]);
    } catch {
        showToast('Some data failed to load. Using available data.');
    } finally {
        hideLoading();
    }
}

// ===== Update Stats =====
function updateStats(sales) {
    const avg = sales.reduce((a, b) => a + b, 0) / sales.length;
    document.getElementById('totalDataPoints').textContent = sales.length;
    document.getElementById('avgSales').textContent = formatCurrency(avg);
    document.getElementById('maxSales').textContent = formatCurrency(Math.max(...sales));
    document.getElementById('minSales').textContent = formatCurrency(Math.min(...sales));
}

// ===== Update MAE Table =====
function updateMAETable(data) {
    const { mae_arima, mae_hw, mae_lstm } = data;

    const values = [mae_arima, mae_hw, mae_lstm];
    const validValues = values.filter(v => v !== null && v !== undefined);
    const minVal = validValues.length ? Math.min(...validValues) : null;
    const maxVal = validValues.length ? Math.max(...validValues) : null;

    function setRow(elId, barId, verdictId, value) {
        const el = document.getElementById(elId);
        const bar = document.getElementById(barId);
        const verdict = document.getElementById(verdictId);

        if (value === null || value === undefined) {
            el.textContent = 'N/A';
            bar.style.width = '0%';
            verdict.innerHTML = '<span class="badge-na">N/A</span>';
            return;
        }

        el.textContent = formatCurrency(value);

        // Bar width: worst = 100%, best = smallest visible bar
        const pct = maxVal > 0 ? ((value / maxVal) * 100).toFixed(1) : 50;
        // Slight delay for animation on tab switch
        setTimeout(() => { bar.style.width = pct + '%'; }, 100);

        if (value === minVal) {
            verdict.innerHTML = '<span class="badge-best">Best</span>';
        } else {
            const diff = (((value - minVal) / minVal) * 100).toFixed(1);
            verdict.textContent = `+${diff}% vs best`;
        }
    }

    setRow('maeArima', 'maeBarArima', 'verdictArima', mae_arima);
    setRow('maeHW',    'maeBarHW',    'verdictHW',    mae_hw);
    setRow('maeLSTM',  'maeBarLSTM',  'verdictLSTM',  mae_lstm);
}

// ===== Chart Utilities =====
function destroyChart(id) {
    if (charts[id]) {
        charts[id].destroy();
        delete charts[id];
    }
}

function baseScaleOptions() {
    return {
        x: { grid: { color: 'rgba(255,255,255,0.05)' } },
        y: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { callback: v => formatCurrency(v) }
        }
    };
}

function baseTooltip(borderColor) {
    return {
        backgroundColor: 'rgba(26,10,46,0.9)',
        titleColor: '#f8fafc',
        bodyColor: '#94a3b8',
        borderColor,
        borderWidth: 1,
        padding: 12,
        callbacks: {
            label: ctx => {
                if (ctx.raw === null || ctx.raw === undefined) return null;
                return ctx.dataset.label + ': ' + formatCurrency(ctx.raw);
            }
        }
    };
}

// ===== Sales Chart =====
function renderSalesChart(data) {
    destroyChart('salesChart');
    const ctx = document.getElementById('salesChart').getContext('2d');

    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(168,85,247,0.4)');
    gradient.addColorStop(1, 'rgba(168,85,247,0)');

    charts['salesChart'] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.dates.map(formatDate),
            datasets: [{
                label: currentAggregationType === 'average' ? 'Avg Weekly Sales' : 'Total Weekly Sales',
                data: data.sales,
                borderColor: '#a855f7',
                backgroundColor: gradient,
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: '#a855f7',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: { display: true, position: 'top' },
                tooltip: {
                    ...baseTooltip('#a855f7'),
                    displayColors: false,
                    callbacks: {
                        label: ctx => 'Sales: ' + formatCurrency(ctx.raw)
                    }
                }
            },
            scales: baseScaleOptions()
        }
    });
}

// ===== Moving Average Chart =====
function renderMovingAvgChart(data) {
    destroyChart('movingAvgChart');
    const ctx = document.getElementById('movingAvgChart').getContext('2d');

    charts['movingAvgChart'] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.dates.map(formatDate),
            datasets: [
                {
                    label: 'Original Sales',
                    data: data.sales,
                    borderColor: '#ec4899',
                    backgroundColor: 'rgba(236,72,153,0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.3,
                    pointRadius: 3,
                    pointBackgroundColor: '#ec4899'
                },
                {
                    label: 'Moving Average (4-week)',
                    data: data.moving_average,
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245,158,11,0.1)',
                    borderWidth: 4,
                    fill: false,
                    tension: 0.3,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: { display: true, position: 'top' },
                tooltip: baseTooltip('#f59e0b')
            },
            scales: baseScaleOptions()
        }
    });
}

// ===== Histogram Chart =====
function renderHistogramChart(data) {
    destroyChart('histogramChart');
    const ctx = document.getElementById('histogramChart').getContext('2d');

    const palette = [
        'rgba(168,85,247,0.7)',  'rgba(236,72,153,0.7)',
        'rgba(6,182,212,0.7)',   'rgba(16,185,129,0.7)',
        'rgba(245,158,11,0.7)',  'rgba(168,85,247,0.7)',
        'rgba(236,72,153,0.7)',  'rgba(6,182,212,0.7)',
        'rgba(16,185,129,0.7)', 'rgba(245,158,11,0.7)',
        'rgba(168,85,247,0.7)',  'rgba(236,72,153,0.7)',
        'rgba(6,182,212,0.7)',   'rgba(16,185,129,0.7)',
        'rgba(245,158,11,0.7)',  'rgba(168,85,247,0.7)',
        'rgba(236,72,153,0.7)',  'rgba(6,182,212,0.7)',
        'rgba(16,185,129,0.7)', 'rgba(245,158,11,0.7)'
    ];
    const colors = data.bins.map((_, i) => palette[i % palette.length]);

    charts['histogramChart'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.bins,
            datasets: [{
                label: 'Frequency',
                data: data.counts,
                backgroundColor: colors,
                borderColor: colors.map(c => c.replace('0.7', '1')),
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(26,10,46,0.9)',
                    borderColor: '#06b6d4',
                    borderWidth: 1,
                    padding: 12,
                    callbacks: { label: ctx => 'Count: ' + ctx.raw }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { maxRotation: 45, minRotation: 45 } },
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true }
            }
        }
    });
}

// ===== Forecast Charts (ARIMA + HW + LSTM individual) =====
function renderForecastCharts(data) {
    const histLen = data.historical_sales.length;
    const fcstLen = data.forecast_dates.length;
    const allLabels = [
        ...data.historical_dates.map(formatDate),
        ...data.forecast_dates.map(formatDate)
    ];
    const histPad = Array(fcstLen).fill(null);
    const fcstPad = Array(histLen).fill(null);

    // --- ARIMA ---
    destroyChart('arimaChart');
    const arimaCtx = document.getElementById('arimaChart').getContext('2d');
    const arimaGrad = arimaCtx.createLinearGradient(0, 0, 0, 300);
    arimaGrad.addColorStop(0, 'rgba(6,182,212,0.3)');
    arimaGrad.addColorStop(1, 'rgba(6,182,212,0)');

    charts['arimaChart'] = new Chart(arimaCtx, {
        type: 'line',
        data: {
            labels: allLabels,
            datasets: [
                {
                    label: 'Historical Sales',
                    data: [...data.historical_sales, ...histPad],
                    borderColor: '#94a3b8',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 3
                },
                {
                    label: 'ARIMA Forecast',
                    data: [...fcstPad, ...data.arima_forecast],
                    borderColor: '#06b6d4',
                    backgroundColor: arimaGrad,
                    borderWidth: 3,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 5,
                    pointBackgroundColor: '#06b6d4',
                    borderDash: [5, 5]
                }
            ]
        },
        options: buildForecastOptions('#06b6d4')
    });

    // --- Holt-Winters ---
    destroyChart('hwChart');
    const hwCtx = document.getElementById('hwChart').getContext('2d');
    const hwGrad = hwCtx.createLinearGradient(0, 0, 0, 300);
    hwGrad.addColorStop(0, 'rgba(16,185,129,0.3)');
    hwGrad.addColorStop(1, 'rgba(16,185,129,0)');

    charts['hwChart'] = new Chart(hwCtx, {
        type: 'line',
        data: {
            labels: allLabels,
            datasets: [
                {
                    label: 'Historical Sales',
                    data: [...data.historical_sales, ...histPad],
                    borderColor: '#94a3b8',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 3
                },
                {
                    label: 'Holt-Winters Forecast',
                    data: [...fcstPad, ...data.holt_winters_forecast],
                    borderColor: '#10b981',
                    backgroundColor: hwGrad,
                    borderWidth: 3,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 5,
                    pointBackgroundColor: '#10b981',
                    borderDash: [5, 5]
                }
            ]
        },
        options: buildForecastOptions('#10b981')
    });

    // --- LSTM ---
    destroyChart('lstmChart');
    const lstmCtx = document.getElementById('lstmChart').getContext('2d');
    const lstmGrad = lstmCtx.createLinearGradient(0, 0, 0, 300);
    lstmGrad.addColorStop(0, 'rgba(245,158,11,0.3)');
    lstmGrad.addColorStop(1, 'rgba(245,158,11,0)');

    const lstmValues = data.lstm_forecast
        ? [...fcstPad, ...data.lstm_forecast]
        : [...fcstPad, ...Array(fcstLen).fill(null)];

    charts['lstmChart'] = new Chart(lstmCtx, {
        type: 'line',
        data: {
            labels: allLabels,
            datasets: [
                {
                    label: 'Historical Sales',
                    data: [...data.historical_sales, ...histPad],
                    borderColor: '#94a3b8',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 3
                },
                {
                    label: 'LSTM Forecast',
                    data: lstmValues,
                    borderColor: '#f59e0b',
                    backgroundColor: lstmGrad,
                    borderWidth: 3,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 5,
                    pointBackgroundColor: '#f59e0b',
                    borderDash: [5, 5]
                }
            ]
        },
        options: buildForecastOptions('#f59e0b')
    });

    // Also render comparison chart (shares same data)
    renderComparisonChart(data);
}

// ===== Comparison Chart (all 3 models) =====
function renderComparisonChart(data) {
    destroyChart('comparisonChart');
    const ctx = document.getElementById('comparisonChart').getContext('2d');

    const histLen = data.historical_sales.length;
    const fcstLen = data.forecast_dates.length;
    const allLabels = [
        ...data.historical_dates.map(formatDate),
        ...data.forecast_dates.map(formatDate)
    ];
    const fcstPad = Array(histLen).fill(null);
    const histPad = Array(fcstLen).fill(null);

    const lstmDataset = data.lstm_forecast
        ? {
            label: 'LSTM Forecast',
            data: [...fcstPad, ...data.lstm_forecast],
            borderColor: '#f59e0b',
            backgroundColor: 'transparent',
            borderWidth: 3,
            tension: 0.3,
            pointRadius: 5,
            pointBackgroundColor: '#f59e0b',
            borderDash: [5, 5]
          }
        : null;

    const datasets = [
        {
            label: 'Historical Sales',
            data: [...data.historical_sales, ...histPad],
            borderColor: '#94a3b8',
            backgroundColor: 'rgba(148,163,184,0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.3,
            pointRadius: 2
        },
        {
            label: 'ARIMA Forecast',
            data: [...fcstPad, ...data.arima_forecast],
            borderColor: '#06b6d4',
            backgroundColor: 'transparent',
            borderWidth: 3,
            tension: 0.3,
            pointRadius: 5,
            pointBackgroundColor: '#06b6d4',
            borderDash: [5, 5]
        },
        {
            label: 'Holt-Winters Forecast',
            data: [...fcstPad, ...data.holt_winters_forecast],
            borderColor: '#10b981',
            backgroundColor: 'transparent',
            borderWidth: 3,
            tension: 0.3,
            pointRadius: 5,
            pointBackgroundColor: '#10b981',
            borderDash: [5, 5]
        }
    ];

    if (lstmDataset) datasets.push(lstmDataset);

    charts['comparisonChart'] = new Chart(ctx, {
        type: 'line',
        data: { labels: allLabels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: { display: true, position: 'top' },
                tooltip: baseTooltip('#a855f7')
            },
            scales: baseScaleOptions()
        }
    });
}

// ===== Shared Forecast Chart Options =====
function buildForecastOptions(accentColor) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
            legend: { display: true, position: 'top' },
            tooltip: baseTooltip(accentColor)
        },
        scales: baseScaleOptions()
    };
}

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
    loadAllData();
});

