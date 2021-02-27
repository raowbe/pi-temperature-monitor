import * as cdk from '@aws-cdk/core';
import * as cloudwatch from '@aws-cdk/aws-cloudwatch'
import { PiTemperatureMonitor } from './pi-temperature-monitor';

export interface PiTemperatureMonitorDashboardProps {
    name: string;
    monitors: Array<PiTemperatureMonitor>;
}

export class PiTemperatureMonitorDashboard extends cdk.Construct {
    constructor(scope: cdk.Construct, id: string, props: PiTemperatureMonitorDashboardProps) {
        super(scope, id);


        const dashboard = new cloudwatch.Dashboard(this, props.name, {
            dashboardName: props.name
        });

        props.monitors.forEach(function (monitor) {
            monitor.sensors.forEach(function (sensor) {
                const singleValueTempWidget = new cloudwatch.SingleValueWidget({
                    title: `${sensor.friendlyName} Current Temperature`,
                    metrics: [sensor.temperatureMetric],
                    setPeriodToTimeRange: false,
                    width: 12
                })

                const timeSeriesTempWidget = new cloudwatch.GraphWidget({
                    title: `${sensor.friendlyName} Temperature`,
                    left: [sensor.temperatureMetric],
                    view: cloudwatch.GraphWidgetView.TIME_SERIES,
                    width: 12
                });

                const singleValueHumidityWidget = new cloudwatch.SingleValueWidget({
                    title: `${sensor.friendlyName} Current Humidity`,
                    metrics: [sensor.humidityMetric],
                    setPeriodToTimeRange: false,
                    width: 12
                })

                const timeSeriesHumidityWidget = new cloudwatch.GraphWidget({
                    title: `${sensor.friendlyName} Humidity`,
                    left: [sensor.humidityMetric],
                    view: cloudwatch.GraphWidgetView.TIME_SERIES,
                    width: 12
                });

                dashboard.addWidgets(singleValueTempWidget, singleValueHumidityWidget)
                dashboard.addWidgets(timeSeriesTempWidget, timeSeriesHumidityWidget);
            });
        });


    }
}
