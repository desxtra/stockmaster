#
# CLOUDWATCH DASHBOARD
#

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "StockMaster-v3-Dashboard"
  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/ElasticBeanstalk", "EnvironmentHealth"],
            ["AWS/ElasticBeanstalk", "ApplicationRequestsTotal"],
            ["AWS/ElasticBeanstalk", "ApplicationRequests5xx"],
            ["AWS/ElasticBeanstalk", "ApplicationRequests4xx"]
          ]
          period = 300
          stat   = "Average"
          region = "us-east-1"  # Replace with your region
          title  = "Application Metrics Widget"
        }
      },
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/RDS", "CPUUtilization"],
            ["AWS/RDS", "DatabaseConnections"],
            ["AWS/RDS", "FreeStorageSpace"],
            ["AWS/RDS", "ReadIOPS"],
            ["AWS/RDS", "WriteIOPS"]
          ]
          period = 300
          stat   = "Average"
          region = "us-east-1"  # Replace with your region
          title  = "Database Metrics Widget"
        }
      },
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/ApplicationELB", "RequestCount"],
            ["AWS/ApplicationELB", "TargetResponseTime"],
            ["AWS/ApplicationELB", "HTTPCode_Target_4XX_Count"],
            ["AWS/ApplicationELB", "HTTPCode_Target_5XX_Count"]
          ]
          period = 300
          stat   = "Average"
          region = "us-east-1"  # Replace with your region
          title  = "ELB Metrics Widget"
        }
      },
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible"],
            ["AWS/SQS", "ApproximateAgeOfOldestMessage"],
            ["AWS/SQS", "NumberOfMessagesSent"],
            ["AWS/SQS", "NumberOfMessagesReceived"]
          ]
          period = 300
          stat   = "Average"
          region = "us-east-1"  # Replace with your region
          title  = "SQS Metrics Widget"
        }
      },
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/SNS", "NumberOfMessagesPublished"],
            ["AWS/SNS", "NumberOfNotificationsDelivered"],
            ["AWS/SNS", "NumberOfNotificationsFailed"]
          ]
          period = 300
          stat   = "Average"
          region = "us-east-1"  # Replace with your region
          title  = "SNS Metrics Widget"
        }
      },
      {
        type = "metric"
        properties = {
          metrics = [
            ["StockMaster/Custom", "InventoryUpdateProcessed"],
            ["StockMaster/Custom", "AuditLogsCreated"],
            ["StockMaster/Custom", "NotificationsSent"],
            ["StockMaster/Custom", "ProductsTracked"]
          ]
          period = 300
          stat   = "Sum"
          region = "us-east-1"  # Replace with your region
          title  = "Business Metrics Widget"
        }
      }
    ]
  })
}

#
# CLOUDWATCH ALARMS
#

resource "aws_cloudwatch_metric_alarm" "high_error_rate" {
  alarm_name          = "High Error Rate Alarm"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "ApplicationRequests5xx"
  namespace           = "AWS/ElasticBeanstalk"
  period              = "300"
  statistic           = "Average"
  threshold           = "5"
  alarm_description   = "Triggers when error rate exceeds 5% over 5 minutes"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "database_high_cpu" {
  alarm_name          = "Database High CPU Alarm"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "Triggers when CPU usage exceeds 80% for 5 minutes"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "low_storage_space" {
  alarm_name          = "Low Storage Space Alarm"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "20"
  unit                = "Percent"
  alarm_description   = "Triggers when available storage drops below 20% for 10 minutes"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "sqs_queue_depth" {
  alarm_name          = "SQS Queue Depth Alarm"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = "300"
  statistic           = "Average"
  threshold           = "100"
  alarm_description   = "Triggers when visible messages exceed 100 for 5 minutes"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "dynamodb_throttling" {
  alarm_name          = "DynamoDB Throttling Alarm"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "ThrottledRequests"
  namespace           = "AWS/DynamoDB"
  period              = "60"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "Triggers when throttling events exceed 10 within 1 minute"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}