#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { PiTemperatureMonitorStack } from '../lib/pi-temperature-monitor-stack';

const app = new cdk.App();
new PiTemperatureMonitorStack(app, 'PiTemperatureMonitorStack');
