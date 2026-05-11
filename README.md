# Walmart Retail Sales Forecasting using ARIMA, Holt-Winters & LSTM

## Overview

This project predicts Walmart weekly retail sales using three different time-series forecasting approaches:

* ARIMA
* Holt-Winters Exponential Smoothing
* LSTM (Long Short-Term Memory Neural Network)

The system compares forecasting performance using MAE (Mean Absolute Error) and visualizes historical sales trends along with future predictions through an interactive dashboard.

---

# Features

* Weekly sales trend analysis
* Moving average visualization
* ARIMA forecasting
* Holt-Winters forecasting
* LSTM deep learning forecasting
* Future sales prediction (10 weeks)
* MAE-based model comparison
* Interactive frontend dashboard

---

# Tech Stack

## Backend

* Python
* TensorFlow / Keras
* Pandas
* NumPy
* Statsmodels
* Scikit-learn

## Frontend

* React
* Tailwind CSS

---

# Project Structure

```bash
project-folder/
│
├── backend/
│   ├── dataset/
│   │   └── Walmart.csv
│   │
│   ├── forecasting.py
│   ├── requirements.txt
│   └── app.py
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.js
│
└── README.md
```

---

# Dataset

Save the dataset file as:

```bash
backend/dataset/Walmart.csv
```

Dataset format:

| Date       | Weekly_Sales |
| ---------- | ------------ |
| 05-02-2010 | 1643690.90   |
| 12-02-2010 | 1641957.44   |

Date format must be:

```bash
DD-MM-YYYY
```

---

# How the LSTM Model Works

1. Weekly sales data is collected and preprocessed.
2. Data is normalized using StandardScaler.
3. A 30-week sliding window is created.
4. The model learns patterns from previous sales.
5. LSTM predicts future weekly sales.
6. Recursive forecasting is used to generate multi-step predictions.

---

# LSTM Architecture

* LSTM Layer: 64 units
* Dropout: 20%
* LSTM Layer: 32 units
* Dense Output Layer
* Epochs: 50
* Train-Test Split: 80-20

---

# Installation

## Backend Setup

```bash
cd backend
pip install -r requirements.txt
```

Run backend:

```bash
python app.py
```

---

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

---

# Output

The dashboard displays:

* Historical sales trends
* Moving averages
* Forecast comparison graphs
* Future sales predictions
* MAE scores for all models

---



# Future Improvements

* Add seasonal forecasting
* Hyperparameter tuning
* Real-time forecasting API
* Store-wise sales prediction
* Transformer-based forecasting models

---

# Author

Ashneet Kaur Chhabra
