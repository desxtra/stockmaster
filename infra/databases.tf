resource "aws_db_instance" "rds" {
  identifier           = "stockmaster-db"
  multi_az             = true
  allocated_storage    = 20
  max_allocated_storage= 200
  storage_type         = "gp3"
  db_name              = "stockmaster_prod"
  engine               = "postgres"
  instance_class       = "db.t3.micro"
  username             = var.db_user
  password             = var.db_pw
  skip_final_snapshot  = true
  vpc_security_group_ids= [aws_security_group.rds.id]
}