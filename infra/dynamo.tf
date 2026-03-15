resource "aws_dynamodb_table" "audit_log" {
  name           = "stockmaster-audit-log"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "auditId"
  range_key      = "timestamp"

  attribute {
    name = "auditId"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "N"
  }

  attribute {
    name = "action"
    type = "S"
  }

  global_secondary_index {
    name            = "ActionTimestampIndex"
    hash_key        = "action"
    range_key       = "timestamp"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Environment = "Production"
    Application = "StockMaster"
  }
}