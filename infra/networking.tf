resource "aws_vpc" "vpc" {
  cidr_block       = var.vpc_cidr
  instance_tenancy = "default"
  enable_dns_support = true
  enable_dns_hostnames = true

  tags = {
    Name = "networking"
  }
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.vpc.id

  tags = {
    Name = "networking"
  }
}

#
# SUBNETS
#

resource "aws_subnet" "pub1" {
  vpc_id     = aws_vpc.vpc.id
  cidr_block = var.pub1_cidr
  availability_zone = var.avzoneA

  tags = {
    Name = "networking"
  }
}

resource "aws_subnet" "pub2" {
  vpc_id     = aws_vpc.vpc.id
  cidr_block = var.pub2_cidr
  availability_zone = var.avzoneB

  tags = {
    Name = "networking"
  }
}

resource "aws_subnet" "priv1" {
  vpc_id     = aws_vpc.vpc.id
  cidr_block = var.priv1_cidr
  availability_zone = var.avzoneA

  tags = {
    Name = "networking"
  }
}

resource "aws_subnet" "priv2" {
  vpc_id     = aws_vpc.vpc.id
  cidr_block = var.priv2_cidr
  availability_zone = var.avzoneB

  tags = {
    Name = "networking"
  }
}

#
# ROUTES
#

resource "aws_route_table" "public_route" {
  vpc_id = aws_vpc.vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }

  tags = {
    Name = "networking"
  }
}

#
# NAT
#

resource "aws_eip" "eip" {
  domain   = "vpc"
}

resource "aws_nat_gateway" "natgw" {
  allocation_id = aws_eip.eip.id
  subnet_id     = aws_subnet.pub1.id

  tags = {
    Name = "networking"
  }

  depends_on = [aws_internet_gateway.igw,aws_eip.eip]
}

resource "aws_route_table" "private_route" {
  vpc_id = aws_vpc.vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.natgw.id
  }

  tags = {
    Name = "networking"
  }
}

resource "aws_route_table_association" "pub1_assoc" {
  subnet_id      = aws_subnet.pub1.id
  route_table_id = aws_route_table.public_route.id
}

resource "aws_route_table_association" "pub2_assoc" {
  subnet_id      = aws_subnet.pub2.id
  route_table_id = aws_route_table.public_route.id
}

resource "aws_route_table_association" "priv1_assoc" {
  subnet_id      = aws_subnet.priv1.id
  route_table_id = aws_route_table.private_route.id
}

resource "aws_route_table_association" "priv2_assoc" {
  subnet_id      = aws_subnet.priv2.id
  route_table_id = aws_route_table.private_route.id
}