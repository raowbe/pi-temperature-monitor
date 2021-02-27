import * as cdk from '@aws-cdk/core';
import * as iam from '@aws-cdk/aws-iam';
import { PiTemperatureSensor } from './pi-temperature-sensor';

export interface PiTemperatureMonitorProps {
  sensorProps: Array<PiTemperatureSensorProps>;
  fahrenheit?: boolean;
}

export interface PiTemperatureSensorProps {
  name: string;
  friendlyName: string;
  emails: Array<string>;
  smsNumbers: Array<string>;
  maxTemperatureThreshold?: number;
  minTemperatureThreshold?: number;
  gpio: number;
}

export class PiTemperatureMonitor extends cdk.Construct {
  public readonly sensors: Array<PiTemperatureSensor>;

  constructor(scope: cdk.Construct, id: string, props: PiTemperatureMonitorProps) {
    super(scope, id);
    const me = this;

    const logGroupArns = new Array<string>();
    const sensors = new Array<PiTemperatureSensor>();

    const cOrF = props.fahrenheit ? "F" : "C"
    props.sensorProps.forEach(function (prop) {
      const sensor = new PiTemperatureSensor(me, prop.name,
        {
          name: prop.name,
          friendlyName: prop.friendlyName,
          emails: prop.emails,
          smsNumbers: prop.smsNumbers,
          maxTemperatureThreshold: prop.maxTemperatureThreshold,
          minTemperatureThreshold: prop.minTemperatureThreshold,
          cOrF: cOrF,
          gpio: prop.gpio
        });

      logGroupArns.push(sensor.logGroupArn);
      sensors.push(sensor);
    });

    this.sensors = sensors;

    const iamPolicyDocument = new iam.PolicyDocument();
    iamPolicyDocument.addStatements(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      resources: ["*"],
      actions: ["logs:DescribeLogStreams"]
    }));

    iamPolicyDocument.addStatements(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      resources: logGroupArns,
      actions: ["logs:PutLogEvents"]
    }))

    const iamPolicy = new iam.Policy(this, `PiTemperatureMonitorPolicy-${id}`, {
      document: iamPolicyDocument
    });
    const iamUser = new iam.User(this, `PiTemperatureMonitorUser-${id}`);
    iamPolicy.attachToUser(iamUser);

    const accessKey = new iam.CfnAccessKey(this, `PiTemperatureMonitorUserAccessKey-${id}`, {
      userName: iamUser.userName
    });

    let setupCommand = `\nchmod +x pi-temp-sensor-setup.sh\nsudo ./pi-temp-sensor-setup.sh ${cOrF} ${this.sensors[0].gpio} ${this.sensors[0].logGroupName} ${this.sensors[0].logStreamName}`;
    if (this.sensors.length > 1) {
      setupCommand += ` ${this.sensors[1].gpio} ${this.sensors[1].logGroupName} ${this.sensors[1].logStreamName}`;
    }
    setupCommand += '\n';

    new cdk.CfnOutput(this, `AccessKeyId`, { value: accessKey.ref });
    new cdk.CfnOutput(this, `SecretAccessKey`, { value: accessKey.attrSecretAccessKey });
    new cdk.CfnOutput(this, `SetupCommand`, { value: setupCommand });
  }
}
