# Temperature Monitor Using Raspberry Pi, DHT22 Sensors, and CloudWatch

This project automates the configuration of your raspberry pi and AWS infrastructure to collect temperature and humidity data.  You can optionally specify temperature thresholds and receive email/sms alerts when the temperature crosses the treshold.

## Prerequesites

 * Raspberry Pi with headers (Pi Zero works fine as long as it has headers)
 * [DHT22 Sensor](https://www.amazon.com/HiLetgo-Temperature-Humidity-Electronic-Practice/dp/B0795F19W6)
 * You may need some [longer jumper wires](https://www.amazon.com/gp/product/B07GD17ZF3)
 * AWS Account
 * AWS CLI, Typescript, and AWS CDK Installed and Configured.  You can follow the [Getting Started Guide for AWS CDK](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html)

## Setup Guide
 
### Connect the Sensor to Your Raspberry Pi 

[This article](https://medium.com/initial-state/how-to-build-a-raspberry-pi-temperature-monitor-8c2f70acaea9) describes how to connect the DH22 sensor.

Credit to this article for being the starting point for this project.  Initial State looks pretty cool, but costs $8-$10/month.  If you are doing a lot of IoT things it might make sense for you.  This solution will likely fit within the AWS Free Tier parameters.

When connecting the sensor, you can choose the GPIO pin that you'd like as you have the opportunity so specify which pin you are using in the code.

### Configure the CDK Stack

The `/lib/pi-temperature-monitor-stack.ts` file is where you will do all of your configuration.

The following code is for 1 raspberry pi with 1 temperature sensor.  The max and min temperature settings are optional.  If specified, CloudWatch Alarms will be created.  If you don't want email or SMS notifications, set these values to empty arrays.

```
    const basement = new PiTemperatureMonitor(this, 'BasementFreezer', {
      fahrenheit: true,
      sensorProps: [
        {
          name: "BasementFreezer", // No spaces or funny characters in this name
          friendlyName: "Basement Freezer",
          emails: ["email@example.com"],
          smsNumbers: ["+1-555-555-5555"],
          gpio: 4,
          maxTemperatureThreshold: 5,
          minTemperatureThreshold: -10
        }
      ]
    });
```

You can also hook up two sensors to a single raspberry pi:

```
    const kitchen = new PiTemperatureMonitor(this, 'KitchenRefridgerator', {
      fahrenheit: true,
      sensorProps: [
        {
          name: "KitchenRefridgerator", // No spaces or funny characters in this name
          friendlyName: "Kitchen Refridgerator",
          emails: ["email@example.com", "email2@example.com"],
          smsNumbers: ["+1-555-555-5555", "+1-555-555-6666"],
          gpio: 4,
          maxTemperatureThreshold: 42
        },
        {
          name: "KitchenFreezer", // No spaces or funny characters in this name
          friendlyName: "Kitchen Freezer",
          emails: ["email@example.com"],
          smsNumbers: ["+1-555-555-5555"],
          gpio: 17,
          maxTemperatureThreshold: 10
        }
      ]
    });
```

You can also create CloudWatch Dashboards to see the current temperature and humididy and to visualize trends.

```
    new PiTemperatureMonitorDashboard(this, 'ColdFoodStorage', {
      name: 'ColdFoodStorage',
      monitors: [
        kitchen,
        basement
      ]
    });
```

When you've configured everthing the way you want it, you can build and deploy!

```
npm install
npm run build
cdk diff
cdk deploy
```

### Raspberry Pi Setup

The outputs from your CDK Deployment will have the following important information for setting up your raspberry pi to send data to cloudwatch:
 * AWS IAM User Access Key ID and Secret Access Key
 * Command to run to configure everything

First, copy the `/pi/pi-temp-sensor-setup.sh` file to your raspberry pi user's home directory.

After the file is there, you can run the command from the CDK Output, which will look something like this:

```
chmod +x pi-temp-sensor-setup.sh
sudo ./pi-temp-sensor-setup.sh PiTemperatureSensorLogGroup-BasementFreezer PiTemperatureSensorLogStream-BasementFreezer
```

Part of the script runs an `aws configure`, so when prompted, you will need to enter the Access Key ID and Secret Access Key.

## Common Issues

If things aren't working, try running `systemctl status temperature-monitor` to see if the service is running successfully.

When setting this up, the most common issue I've seen is the sensor not being hooked up properly (to the right pins).

You can run a simple Python script like this one to help troubleshoot the issue
```
import adafruit_dht
import time
import board
import logging
import datetime
import boto3
import json

dhtSensor = adafruit_dht.DHT22(board.D4)

while True:
    timestamp = int(round(time.time() * 1000))
    try:
        humidity = dhtSensor.humidity
        temp_c = dhtSensor.temperature
    except RuntimeError:
        print("RuntimeError, trying again...")
        time.sleep(60)
        continue

    temp_f = format(temp_c * 9.0 / 5.0 + 32.0, ".2f")
    print(f"Temperature(F): {temp_f}")
    humidity = format(humidity,".2f")
    print(f"Humidity(%) {humidity}")

    time.sleep(60)
```

## Future Enhancements

 *  Better error logging/handling in the `tempsensor.py` script.
 * Automatic restarting of the systemd service on failure - it has been pretty stable for me, but I had one instance where it needed to be restarted.