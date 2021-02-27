import * as sns from '@aws-cdk/aws-sns';
import * as subs from '@aws-cdk/aws-sns-subscriptions';
import * as cdk from '@aws-cdk/core';
import * as logs from '@aws-cdk/aws-logs'
import * as cloudwatch from '@aws-cdk/aws-cloudwatch'
import * as cloudwatchActions from '@aws-cdk/aws-cloudwatch-actions'
import * as lambda from '@aws-cdk/aws-lambda'
import * as lambdaEventSources from '@aws-cdk/aws-lambda-event-sources'
import * as path from 'path';
import * as iam from '@aws-cdk/aws-iam';

export interface PiTemperatureSensorProps {
  name: string;
  friendlyName: string;
  emails: Array<string>;
  smsNumbers: Array<string>;
  maxTemperatureThreshold?: number;
  minTemperatureThreshold?: number;
  cOrF: string;
  gpio: number;
}

export class PiTemperatureSensor extends cdk.Construct {
  public readonly name: string;
  public readonly friendlyName: string;
  public readonly gpio: number;
  public readonly logGroupArn: string;
  public readonly logGroupName: string;
  public readonly logStreamName: string;
  public readonly temperatureMetric: cloudwatch.Metric;
  public readonly humidityMetric: cloudwatch.Metric;

  constructor(scope: cdk.Construct, id: string, props: PiTemperatureSensorProps) {
    super(scope, id);

    this.name = props.name;
    this.friendlyName = props.friendlyName;
    this.gpio = props.gpio;

    const lambdaTopic = new sns.Topic(this, `PiTemperatureSensorSnsLambdaTopic-${this.name}`);

    const logGroup = new logs.LogGroup(this, `PiTemperatureSensorLogGroup-${this.name}`, {
      logGroupName: `PiTemperatureSensorLogGroup-${this.name}`
    });

    this.logGroupArn = logGroup.logGroupArn;
    this.logGroupName = logGroup.logGroupName;

    const logStream = new logs.LogStream(this, `PiTemperatureSensorLogStream-${this.name}`, {
      logGroup: logGroup,
      logStreamName: `PiTemperatureSensorLogStream-${this.name}`
    });

    this.logStreamName = logStream.logStreamName;

    const metricNamespace = `PiTemperatureSensorMetricNamespace-${this.name}`
    const temperatureMetricName = `${this.name} Temperature`

    this.temperatureMetric = new cloudwatch.Metric({
      namespace: metricNamespace,
      metricName: temperatureMetricName
    })

    new logs.MetricFilter(this, `PiTemperatureSensorMetricFilterTemperature-${this.name}`, {
      metricName: temperatureMetricName,
      metricNamespace: metricNamespace,
      logGroup: logGroup,
      filterPattern: logs.FilterPattern.stringValue("$.temperature", "=", "*"),
      metricValue: "$.temperature"
    })

    const humidityMetricName = `${this.name} Humidity`

    this.humidityMetric = new cloudwatch.Metric({
      namespace: metricNamespace,
      metricName: humidityMetricName
    })

    new logs.MetricFilter(this, `PiTemperatureSensorMetricFilterHumidity-${this.name}`, {
      metricName: humidityMetricName,
      metricNamespace: metricNamespace,
      logGroup: logGroup,
      filterPattern: logs.FilterPattern.stringValue("$.humidity", "=", "*"),
      metricValue: "$.humidity"
    })

    let maxTemperatureThresholdString = "";
    let maxTemperatureThresholdAlarmName = `PiTemperatureSensorAlarmMaxTempThreshold-${this.name}`;
    if (props.maxTemperatureThreshold != null) {
      const alarm = new cloudwatch.Alarm(this, maxTemperatureThresholdAlarmName, {
        metric: this.temperatureMetric,
        evaluationPeriods: 1,
        actionsEnabled: true,
        alarmName: maxTemperatureThresholdAlarmName,
        alarmDescription: "This metric monitors the temperature gets too high.",
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.MISSING,
        period: cdk.Duration.minutes(5),
        threshold: props.maxTemperatureThreshold,
        statistic: "Average"
      });
      alarm.addAlarmAction(new cloudwatchActions.SnsAction(lambdaTopic));
      alarm.addInsufficientDataAction(new cloudwatchActions.SnsAction(lambdaTopic));
      alarm.addOkAction(new cloudwatchActions.SnsAction(lambdaTopic));
      maxTemperatureThresholdString = props.maxTemperatureThreshold.toString();
    }
    else {
      maxTemperatureThresholdAlarmName = ""
    }

    let minTemperatureThresholdString = "";
    let minTemperatureThresholdAlarmName = `PiTemperatureSensorAlarmMinTempThreshold-${this.name}`;
    if (props.minTemperatureThreshold != null) {
      const alarm = new cloudwatch.Alarm(this, minTemperatureThresholdAlarmName, {
        metric: this.temperatureMetric,
        evaluationPeriods: 1,
        actionsEnabled: true,
        alarmName: minTemperatureThresholdAlarmName,
        alarmDescription: "This metric monitors the temperature gets too low.",
        comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.MISSING,
        period: cdk.Duration.minutes(5),
        threshold: props.minTemperatureThreshold,
        statistic: "Average"
      });
      alarm.addAlarmAction(new cloudwatchActions.SnsAction(lambdaTopic));
      alarm.addInsufficientDataAction(new cloudwatchActions.SnsAction(lambdaTopic));
      alarm.addOkAction(new cloudwatchActions.SnsAction(lambdaTopic));
      minTemperatureThresholdString = props.minTemperatureThreshold.toString();
    }
    else {
      minTemperatureThresholdAlarmName = "";
    }

    const notificationTopic = new sns.Topic(this, `PiTemperatureSensorSnsNotificationTopic-${this.name}`);

    props.emails.forEach(function (email: string) {
      notificationTopic.addSubscription(new subs.EmailSubscription(email));
    });

    props.smsNumbers.forEach(function (smsNumber: string) {
      notificationTopic.addSubscription(new subs.SmsSubscription(smsNumber));
    });

    const fn = new lambda.Function(this, `PiTemperatureSensorLambda-${this.name}`, {
      functionName: `PiTemperatureSensorLambda-${this.name}`,
      runtime: lambda.Runtime.PYTHON_3_8,
      handler: 'index.lambda_handler',
      environment: {
        NAME: this.name,
        FRIENDLY_NAME: this.friendlyName,
        MAX_TEMP_THRESHOLD: maxTemperatureThresholdString,
        MIN_TEMP_THRESHOLD: minTemperatureThresholdString,
        MAX_TEMP_THRESHOLD_ALARM_NAME: maxTemperatureThresholdAlarmName,
        MIN_TEMP_THRESHOLD_ALARM_NAME: minTemperatureThresholdAlarmName,
        SNS_ARN: notificationTopic.topicArn,
        C_OR_F: props.cOrF
      },
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda')),
    });

    fn.addEventSource(new lambdaEventSources.SnsEventSource(lambdaTopic));
    notificationTopic.grantPublish(fn);
    fn.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      resources: ["*"],
      actions: ["cloudwatch:GetMetricStatistics"]
    }));
  }
}
