resource "aws_security_group" "alb" {
  name        = "stockmaster-alb-sg"
  description = "for load balancer"
  vpc_id      = aws_vpc.vpc.id

  tags = {
    Name = "security"
  }
}

resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  security_group_id = aws_security_group.alb.id

  ip_protocol = "tcp"
  from_port   = 80
  to_port     = 80
  cidr_ipv4   = "0.0.0.0/0"
}

resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  security_group_id = aws_security_group.alb.id

  ip_protocol = "tcp"
  from_port   = 443
  to_port     = 443
  cidr_ipv4   = "0.0.0.0/0"
}

resource "aws_security_group" "eb" {
  name        = "stockmaster-eb-sg"
  description = "for elastic beanstalk"
  vpc_id      = aws_vpc.vpc.id

  tags = {
    Name = "security"
  }
}

resource "aws_vpc_security_group_ingress_rule" "eb_http" {
  security_group_id = aws_security_group.eb.id

  ip_protocol = "tcp"
  from_port   = 80
  to_port     = 80
  referenced_security_group_id = aws_security_group.alb.id
}

resource "aws_vpc_security_group_ingress_rule" "eb_app" {
  security_group_id = aws_security_group.alb.id

  ip_protocol = "tcp"
  from_port   = 3000
  to_port     = 3000
  referenced_security_group_id = aws_security_group.alb.id
}

resource "aws_vpc_security_group_ingress_rule" "eb_ssh" {
  security_group_id = aws_security_group.eb.id

  ip_protocol = "tcp"
  from_port   = 22
  to_port     = 22
  cidr_ipv4   = "10.180.0.0/16"
}

resource "aws_security_group" "rds" {
  name        = "stockmaster-rds-sg"
  description = "for postgresql rds"
  vpc_id      = aws_vpc.vpc.id

  tags = {
    Name = "security"
  }
}

resource "aws_vpc_security_group_ingress_rule" "rds_postgre" {
  security_group_id = aws_security_group.rds.id

  ip_protocol = "tcp"
  from_port   = 5432
  to_port     = 5432
  referenced_security_group_id = aws_security_group.eb.id
}

resource "aws_security_group" "efs" {
  name        = "stockmaster-efs-sg"
  description = "for postgresql efs"
  vpc_id      = aws_vpc.vpc.id

  tags = {
    Name = "security"
  }
}

resource "aws_vpc_security_group_ingress_rule" "efs_rule" {
  security_group_id = aws_security_group.efs.id

  ip_protocol = "tcp"
  from_port   = 2049
  to_port     = 2049
  referenced_security_group_id = aws_security_group.eb.id
}