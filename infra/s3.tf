resource "aws_s3_bucket" "backup" {
  bucket = "stockmaster-backup-12345"
  
  tags = {
    Name        = "stockmaster-backup-12345"
    Environment = "production"
  }
}

resource "aws_s3_bucket_versioning" "backup_versioning" {
  bucket = aws_s3_bucket.backup.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "backup_lifecycle" {
  bucket = aws_s3_bucket.backup.id

  rule {
    id     = "transition_to_glacier_and_expire"
    status = "Enabled"

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    expiration {
      days = 365
    }
  }
}

resource "aws_s3_bucket_policy" "backup_policy" {
  bucket = aws_s3_bucket.backup.id
  policy = data.aws_iam_policy_document.backup_policy.json
}

data "aws_iam_policy_document" "backup_policy" {
  statement {
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:PutObject"
    ]
    resources = [
      "${aws_s3_bucket.backup.arn}/*"
    ]
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::652582397480:instance-profile/LabRole"]
    }
  }
}

resource "aws_s3_bucket" "static" {
  bucket = "stockmaster-static-12345"
  
  tags = {
    Name        = "stockmaster-static-12345"
    Environment = "production"
  }
}

resource "aws_s3_bucket_website_configuration" "static_website" {
  bucket = aws_s3_bucket.static.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "error.html"
  }
}

##resource "aws_s3_bucket_cors_configuration" "static_cors" {
##  bucket = aws_s3_bucket.static.id
##
##  cors_rule {
##    allowed_headers = ["*"]
##    allowed_methods = ["GET", "POST", "PUT"]
##    allowed_origins = ["<elastic-beanstalk-url>"]  # will replace later
##    expose_headers  = []
##    max_age_seconds = 3000
##  }
##}