import { expect as expectCDK, haveResource } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as PiTemperatureMonitor from '../lib/pi-temperature-monitor-stack';

// TODO: Write some real tests
test('Log Group Created', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new PiTemperatureMonitor.PiTemperatureMonitorStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(haveResource("AWS::Logs::LogGroup",{
    }));
});
