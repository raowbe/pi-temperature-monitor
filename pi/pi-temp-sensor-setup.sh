#!/bin/bash

TempCOrF=$1
Gpio=$2
LogGroupName=$3
LogStreamName=$4
Gpio2=$5
LogGroupName2=$6
LogStreamName2=$7

sudo apt-get update
sudo apt-get install python3-pip libgpiod2 -y
sudo -u pi pip3 install awscli boto3 adafruit-circuitpython-dht --upgrade --user
sudo -u pi /home/pi/.local/bin/aws configure
echo "export PATH=/home/pi/.local/bin:\$PATH" >> /home/pi/.bashrc

read -r -d '' TEMPERATURE_SENSOR_SCRIPT << EOM
import adafruit_dht
import time
import board
import logging
import datetime
import boto3
import json

def take_reading_and_log(dht_sensor, log_group_name, log_stream_name, temp_c_or_f):
    timestamp = int(round(time.time() * 1000))
    try:
        humidity = dht_sensor.humidity
        temp = dht_sensor.temperature
    except RuntimeError:
        print("RuntimeError, trying again...")
        # Log CloudWatch Error
        return

    if temp_c_or_f == "F":
        temp = format(temp * 9.0 / 5.0 + 32.0, ".2f")
    else:
        temp = format(temp, ".2f")
    
    # print(f"Temperature(F): {temp}")
    humidity = format(humidity,".2f")
    # print(f"Humidity(%) {humidity}")

    logs = boto3.client('logs', region_name='us-east-1')
    response = logs.describe_log_streams(
            logGroupName = log_group_name
    )
    next_token = None

    try:
        next_token = response['logStreams'][0]["uploadSequenceToken"]
    except:
        pass
 
    message = {
                'temperature': temp,
                'humidity': humidity
            }

    log_events = [
            {
                'timestamp': timestamp,
                'message': json.dumps(message)
            },
        ]
 
    try:
        if next_token is None:
            response = logs.put_log_events(
                logGroupName = log_group_name,
                logStreamName = log_stream_name,
                logEvents = log_events
            )
        else:
            response = logs.put_log_events(
                logGroupName = log_group_name,
                logStreamName = log_stream_name,
                logEvents = log_events,
                sequenceToken = next_token
            )

        # print(response)
    except:
        # Log Local Error
        pass


# ------- Variable Settings -------
minutes_between_reads = 1
temp_c_or_f="##TempCOrF##"
log_group_name="##LogGroupName##"
log_stream_name="##LogStreamName##"
log_group_name_2="##LogGroupName2##"
log_stream_name_2="##LogStreamName2##"
# ---------------------------------

dht_sensor = adafruit_dht.DHT22(board.D##Gpio##)
if log_group_name_2 != "" and log_stream_name_2 != "":
    dht_sensor_2 = adafruit_dht.DHT22(board.D##Gpio2##)

while True:
    take_reading_and_log(dht_sensor, log_group_name, log_stream_name, temp_c_or_f)

    if log_group_name_2 != "" and log_stream_name_2 != "":
        take_reading_and_log(dht_sensor_2, log_group_name_2, log_stream_name_2, temp_c_or_f)

    time.sleep(60*minutes_between_reads)

EOM

TEMPERATURE_SENSOR_SCRIPT=`echo "$TEMPERATURE_SENSOR_SCRIPT" | sed "s/##TempCOrF##/${TempCOrF}/" | sed "s/##LogGroupName##/${LogGroupName}/" | sed "s/##LogStreamName##/${LogStreamName}/" | sed "s/##LogGroupName2##/${LogGroupName2}/" | sed "s/##LogStreamName2##/${LogStreamName2}/" | sed "s/##Gpio##/${Gpio}/" | sed "s/##Gpio2##/${Gpio2}/"`

echo "$TEMPERATURE_SENSOR_SCRIPT" > /home/pi/temperature-sensor.py

sudo cat >/etc/systemd/system/temperature-monitor.service <<EOF 
[Unit]
Description=Temperature Monitor

[Service]
Type=simple
User=pi
Group=pi
ExecStart=/usr/bin/python3 /home/pi/temperature-sensor.py
Environment=PYTHONUNBUFFERED=1
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl start temperature-monitor
sudo systemctl enable temperature-monitor.service
