import * as cdk from '@aws-cdk/core';
import { PiTemperatureMonitor } from './pi-temperature-monitor';
import { PiTemperatureMonitorDashboard } from './pi-temperature-monitor-dashboard';

export class PiTemperatureMonitorStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

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

    new PiTemperatureMonitorDashboard(this, 'ColdFoodStorage', {
      name: 'ColdFoodStorage',
      monitors: [
        kitchen,
        basement
      ]
    });
  }
}
