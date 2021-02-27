import boto3
import json
import os
import datetime

def lambda_handler(event, context):
    for record in event.get("Records"):
        message = json.loads(record.get("Sns").get("Message"))
        alarm_state = message.get("NewStateValue")
        old_alarm_state = message.get("OldStateValue")
        comparison_operator = message.get("Trigger").get("ComparisonOperator")
        threshold = message.get("Trigger").get("Threshold")
          
        sensor_name = os.getenv('FRIENDLY_NAME')
        c_or_f = os.getenv("C_OR_F")

        print(f"Alarm State: {alarm_state}, ComparisonOperator: {comparison_operator}, Threshold: {threshold}")
        
        send_message = True
        if (alarm_state == "OK" and old_alarm_state == "ALARM"):
            if comparison_operator == "LessThanOrEqualToThreshold":
                subject = f"{sensor_name} temperature is back to normal."
                alert_message = f"{sensor_name} has returned to a normal temperature range.  Previously was below threshold of {threshold}° {c_or_f}."
            if comparison_operator == "GreaterThanOrEqualToThreshold":
                subject = f"{sensor_name} temperature is back to normal."
                alert_message = f"{sensor_name} has returned to a normal temperature range.  Previously was above threshold of {threshold}° {c_or_f}."
        if (alarm_state == "OK" and old_alarm_state == "INSUFFICIENT_DATA"):
                subject = f"{sensor_name} reporting data again in expected range."
                alert_message = f"{sensor_name} has started reporting data again and is within the expected temperature range."
                # Don't send message twice if both max and min alarms are active, don't send message if not in range because other alarm will be in an alarm state
                if not (should_send_insufficient_data_message(message) and is_temparature_within_range(message)):
                    send_message = False
        if (alarm_state == "ALARM"):
            if comparison_operator == "LessThanOrEqualToThreshold":
                subject = f"ALERT: {sensor_name} temperature is too low."
                alert_message = f"{sensor_name} has gone below the minimim temperature threshold of {threshold}° {c_or_f}."
            if comparison_operator == "GreaterThanOrEqualToThreshold":
                subject = f"ALERT: {sensor_name} temperature is too high."
                alert_message = f"{sensor_name} has gone above the maximum temperature threshold of {threshold}° {c_or_f}."
        if (alarm_state == "INSUFFICIENT_DATA"):
                subject = f"ALERT: {sensor_name} has stopped reporting data."
                alert_message = f"ALERT: {sensor_name} has stopped reporting data."
                # Don't send message twice if both max and min alarms are active
                if not should_send_insufficient_data_message(message):
                    send_message = False
        
        if send_message:
            print("Sending Alert Message")
            sns_client = boto3.client('sns')
            response = sns_client.publish(
                TopicArn=os.environ['SNS_ARN'],
                Message=alert_message,
                Subject=subject,
                MessageStructure='string'
            )
            print(response)
        else:
            print("Not Sending Alert Message")

def get_current_temperature(message):
    metric_name = message.get("Trigger").get("MetricName")
    namespace = message.get("Trigger").get("Namespace")
    end_time_string = message.get("StateChangeTime")
    end_time = datetime.datetime.strptime(end_time_string, '%Y-%m-%dT%H:%M:%S.%f+0000')
    five_minutes = datetime.timedelta(minutes=5)
    start_time = end_time - five_minutes

    cloudwatch = boto3.client('cloudwatch')
    stats = cloudwatch.get_metric_statistics(
            Namespace=namespace,
            MetricName=metric_name,
            Dimensions=[],  
            Period=300,
            Statistics=['Average'],
            StartTime=start_time.isoformat(),
            EndTime=end_time.isoformat()
    )
    return stats.get('Datapoints')[0].get('Average')

def should_send_insufficient_data_message(message):
    max_temp_threshold_alarm_name = os.getenv('MAX_TEMP_THRESHOLD_ALARM_NAME')
    min_temp_threshold_alarm_name = os.getenv('MIN_TEMP_THRESHOLD_ALARM_NAME')
    
    if max_temp_threshold_alarm_name == "" or min_temp_threshold_alarm_name == "":
        return True
    
    # if both alarms enabled, only allow the max alarm to send the notification
    alarm_name = message.get('AlarmName')
    return max_temp_threshold_alarm_name == alarm_name
    
def is_temparature_within_range(message):
    max_temp_threshold = os.getenv('MAX_TEMP_THRESHOLD')
    min_temp_threshold = os.getenv('MIN_TEMP_THRESHOLD')
    current_temperature = get_current_temperature(message)
    
    if max_temp_threshold == "":
        return float(current_temperature) >= float(min_temp_threshold)
    elif min_temp_threshold == "":
        return float(current_temperature) <= float(max_temp_threshold)
    else:
        return float(current_temperature) >= float(min_temp_threshold) and float(current_temperature) <= float(max_temp_threshold)
    
    
    