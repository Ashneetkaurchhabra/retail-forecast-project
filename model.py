import pandas as pd
import numpy as np
from pathlib import Path

# -----------------------
# LIBRARIES
# -----------------------
from statsmodels.tsa.statespace.sarimax import SARIMAX
from statsmodels.tsa.holtwinters import ExponentialSmoothing

try:
    from pmdarima import auto_arima
    AUTO_ARIMA_AVAILABLE = True
except:
    AUTO_ARIMA_AVAILABLE = False

# LSTM
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.callbacks import EarlyStopping
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error

print("✅ TensorFlow:", tf.__version__)

# -----------------------
# PATH
# -----------------------
DATASET_PATH = Path(__file__).parent / "dataset" / "Walmart.csv"


# -----------------------
# LOAD DATA
# -----------------------
def load_data():
    df = pd.read_csv(DATASET_PATH)
    df['Date'] = pd.to_datetime(df['Date'], format='%d-%m-%Y')
    return df.sort_values('Date')


def get_weekly_data(aggregation_type='average'):
    df = load_data()
    if aggregation_type == 'total':
        return df.groupby('Date')['Weekly_Sales'].sum().reset_index()
    return df.groupby('Date')['Weekly_Sales'].mean().reset_index()


# -----------------------
# BASIC APIs
# -----------------------
def get_processed_data(aggregation_type='average'):
    weekly = get_weekly_data(aggregation_type)
    return {
        'dates': weekly['Date'].dt.strftime('%Y-%m-%d').tolist(),
        'sales': weekly['Weekly_Sales'].round(2).tolist()
    }


def get_moving_average(aggregation_type='average', window=4):
    weekly = get_weekly_data(aggregation_type)
    weekly['MA'] = weekly['Weekly_Sales'].rolling(window=window).mean()

    return {
        'dates': weekly['Date'].dt.strftime('%Y-%m-%d').tolist(),
        'sales': weekly['Weekly_Sales'].round(2).tolist(),
        'moving_average': [
            None if pd.isna(x) else round(x, 2)
            for x in weekly['MA']
        ]
    }


def get_histogram_data(bins=20):
    df = load_data()
    values = df['Weekly_Sales'].values

    counts, edges = np.histogram(values, bins=bins)

    labels = [
        f"{edges[i]/1_000_000:.1f}M-{edges[i+1]/1_000_000:.1f}M"
        for i in range(len(edges) - 1)
    ]

    return {
        'bins': labels,
        'counts': counts.tolist()
    }


# -----------------------
# 🔥 LSTM FORECAST
# -----------------------
def get_lstm_forecast(aggregation_type='average', steps=10):

    weekly = get_weekly_data(aggregation_type)
    values = weekly['Weekly_Sales'].values.reshape(-1, 1)

    if len(values) < 60:
        return {'lstm_forecast': None, 'mae_lstm': None}

    scaler = StandardScaler()
    values_scaled = scaler.fit_transform(values)

    lookback = 30

    X, y = [], []
    for i in range(len(values_scaled) - lookback):
        X.append(values_scaled[i:i+lookback])
        y.append(values_scaled[i+lookback])

    X, y = np.array(X), np.array(y)

    train_size = int(len(X) * 0.8)
    X_train, y_train = X[:train_size], y[:train_size]
    X_test, y_test = X[train_size:], y[train_size:]

    model = Sequential([
        LSTM(64, return_sequences=True, input_shape=(lookback, 1)),
        Dropout(0.2),
        LSTM(32),
        Dropout(0.2),
        Dense(1)
    ])

    model.compile(optimizer='adam', loss='mse')

    es = EarlyStopping(monitor='val_loss', patience=10, restore_best_weights=True)

    model.fit(
        X_train, y_train,
        epochs=50,
        batch_size=8,
        validation_data=(X_test, y_test),
        callbacks=[es],
        verbose=0
    )

    preds = model.predict(X_test, verbose=0)
    preds_inv = scaler.inverse_transform(preds)
    y_test_inv = scaler.inverse_transform(y_test)

    mae = mean_absolute_error(y_test_inv, preds_inv)

    seq = values_scaled[-lookback:].reshape(1, lookback, 1)
    forecast = []

    for _ in range(steps):
        next_pred = model.predict(seq, verbose=0)
        forecast.append(next_pred[0][0])

        seq = np.concatenate(
            (seq[:, 1:, :], next_pred.reshape(1, 1, 1)),
            axis=1
        )

    forecast = scaler.inverse_transform(
        np.array(forecast).reshape(-1, 1)
    ).flatten()

    return {
        'lstm_forecast': [round(float(x), 2) for x in forecast],
        'mae_lstm': round(float(mae), 2)
    }


# -----------------------
# 🔥 MAIN FORECAST FUNCTION
# -----------------------
def get_forecasts(aggregation_type='average', steps=10):

    weekly = get_weekly_data(aggregation_type)
    weekly = weekly.set_index('Date')
    sales = weekly['Weekly_Sales']

    train_size = int(len(sales) * 0.8)
    train, test = sales[:train_size], sales[train_size:]

    if len(test) == 0:
        raise Exception("Test set is empty → cannot compute MAE")

    # -----------------------
    # ARIMA
    # -----------------------
    if AUTO_ARIMA_AVAILABLE:
        auto = auto_arima(train, seasonal=False, suppress_warnings=True)
        order = auto.order
    else:
        order = (1, 1, 1)

    arima_model = SARIMAX(train, order=order).fit(disp=False)
    arima_pred = arima_model.forecast(len(test))
    mae_arima = mean_absolute_error(test, arima_pred)

    # future forecast
    arima_future = arima_model.forecast(steps)

    # -----------------------
    # HOLT-WINTERS
    # -----------------------
    hw_model = ExponentialSmoothing(
        train,
        trend='add',
        seasonal=None
    ).fit()

    hw_pred = hw_model.forecast(len(test))
    mae_hw = mean_absolute_error(test, hw_pred)

    hw_future = hw_model.forecast(steps)

    # -----------------------
    # LSTM
    # -----------------------
    lstm_out = get_lstm_forecast(aggregation_type, steps)

    # -----------------------
    # DATES
    # -----------------------
    future_dates = pd.date_range(
        start=weekly.index[-1] + pd.Timedelta(weeks=1),
        periods=steps,
        freq='W'
    )

    # -----------------------
    # RETURN (MATCHES FRONTEND EXACTLY)
    # -----------------------
    return {
        'historical_dates': weekly.index.strftime('%Y-%m-%d').tolist(),
        'historical_sales': [round(float(x), 2) for x in sales],

        'forecast_dates': future_dates.strftime('%Y-%m-%d').tolist(),

        'arima_forecast': [round(float(x), 2) for x in arima_future],
        'holt_winters_forecast': [
            round(float(x), 2) for x in hw_future
        ],
        'lstm_forecast': lstm_out['lstm_forecast'],

        # ✅ CORRECT KEYS (THIS FIXES YOUR UI)
        'mae_arima': round(float(mae_arima), 2),
        'mae_hw': round(float(mae_hw), 2),
        'mae_lstm': lstm_out['mae_lstm']
    }