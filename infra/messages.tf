resource "aws_sns_topic" "alerts" {
  name         = "stockmaster-alerts-topic"
  display_name = "StockMaster Alerts"
}

resource "aws_sns_topic_subscription" "email_subscription" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = "malvinsans@gmail.com"
}

resource "aws_sqs_queue" "dlq" {
  name                      = "stockmaster-dlq"
  message_retention_seconds = 345600  # 4 days
}

resource "aws_sqs_queue" "inventory_queue" {
  name                       = "stockmaster-inventory-queue"
  visibility_timeout_seconds = 30
  message_retention_seconds  = 345600  # 4 days
  receive_wait_time_seconds  = 0
  
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = 3
  })
}