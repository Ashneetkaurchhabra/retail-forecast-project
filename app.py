from flask import Flask, jsonify, request
from flask_cors import CORS
import pandas as pd
import numpy as np

from model import (
    get_processed_data,
    get_moving_average,
    get_histogram_data,
    get_forecasts
)

app = Flask(__name__)
CORS(app)


# -----------------------
# HEALTH CHECK
# -----------------------
@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'message': 'Backend is running'
    })


# -----------------------
# BASIC DATA
# -----------------------
@app.route('/data', methods=['GET'])
def get_data():
    aggregation_type = request.args.get('type', 'average')

    try:
        data = get_processed_data(aggregation_type)
        return jsonify({
            'success': True,
            'data': data
        })

    except Exception as e:
        print("DATA ERROR:", e)
        return jsonify({
            'success': False,
            'error': str(e)
        })


# -----------------------
# MOVING AVERAGE
# -----------------------
@app.route('/moving-average', methods=['GET'])
def moving_average():
    aggregation_type = request.args.get('type', 'average')
    window = int(request.args.get('window', 4))

    try:
        data = get_moving_average(aggregation_type, window)
        return jsonify({
            'success': True,
            'data': data
        })

    except Exception as e:
        print("MA ERROR:", e)
        return jsonify({
            'success': False,
            'error': str(e)
        })


# -----------------------
# HISTOGRAM
# -----------------------
@app.route('/histogram', methods=['GET'])
def histogram():
    try:
        data = get_histogram_data()
        return jsonify({
            'success': True,
            'data': data
        })

    except Exception as e:
        print("HISTOGRAM ERROR:", e)
        return jsonify({
            'success': False,
            'error': str(e)
        })


# -----------------------
# FORECAST (KEY FIX AREA)
# -----------------------
@app.route('/forecast', methods=['GET'])
def forecast():
    aggregation_type = request.args.get('type', 'average')
    steps = int(request.args.get('steps', 10))

    try:
        data = get_forecasts(aggregation_type, steps)

        # 🔴 DEBUG PRINT (important)
        print("FORECAST DATA:", data)

        return jsonify({
            'success': True,
            'data': data
        })

    except Exception as e:
        print("FORECAST ERROR:", e)

        return jsonify({
            'success': False,
            'error': str(e)
        })


# -----------------------
# RUN
# -----------------------
if __name__ == '__main__':
    app.run(debug=True, port=5000)