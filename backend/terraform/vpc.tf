# ==============================================================================
# AWS VPC & PRIVATELINK INFRASTRUCTURE (PHỤ TRÁCH: NGUYỄN THỊ NGỌC HÀ - 24020115)
# Kiến trúc cách ly mạng Zero-Trust: Private Subnets, Gateway Endpoints & Rekognition Interface Endpoint
# ==============================================================================

# 1. Khởi tạo Virtual Private Cloud (VPC)
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "${var.project_name}-vpc-${var.environment}"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
  }
}

# 2. Hai Private Subnets cách ly trải dài trên 2 Availability Zones (AZs)
resource "aws_subnet" "private_a" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.1.0/24"
  availability_zone = "${var.aws_region}a"

  tags = {
    Name        = "${var.project_name}-subnet-private-a-${var.environment}"
    Environment = var.environment
    Type        = "IsolatedPrivate"
  }
}

resource "aws_subnet" "private_b" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.2.0/24"
  availability_zone = "${var.aws_region}b"

  tags = {
    Name        = "${var.project_name}-subnet-private-b-${var.environment}"
    Environment = var.environment
    Type        = "IsolatedPrivate"
  }
}

# 3. Route Table cho Private Subnets
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name        = "${var.project_name}-rt-private-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_route_table_association" "private_a" {
  subnet_id      = aws_subnet.private_a.id
  route_table_id = aws_route_table.private.id
}

resource "aws_route_table_association" "private_b" {
  subnet_id      = aws_subnet.private_b.id
  route_table_id = aws_route_table.private.id
}

# 4. Gateway VPC Endpoints ($0.00 NAT Cost) cho S3 và DynamoDB
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${var.aws_region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.private.id]

  tags = {
    Name        = "${var.project_name}-vpce-s3"
    Environment = var.environment
  }
}

resource "aws_vpc_endpoint" "dynamodb" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${var.aws_region}.dynamodb"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.private.id]

  tags = {
    Name        = "${var.project_name}-vpce-dynamodb"
    Environment = var.environment
  }
}

# 5. Security Group cho Interface VPC Endpoint (Amazon Rekognition)
resource "aws_security_group" "rekognition_endpoint_sg" {
  name        = "${var.project_name}-sg-rekognition-endpoint-${var.environment}"
  description = "Cho phep traffic HTTPS tu VPC toi Amazon Rekognition Interface Endpoint"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTPS inbound tu VPC"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [aws_vpc.main.cidr_block]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project_name}-sg-rekognition-endpoint"
    Environment = var.environment
  }
}

# 6. Interface VPC Endpoint (AWS PrivateLink) cho Amazon Rekognition
resource "aws_vpc_endpoint" "rekognition" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${var.aws_region}.rekognition"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = [aws_subnet.private_a.id, aws_subnet.private_b.id]
  security_group_ids  = [aws_security_group.rekognition_endpoint_sg.id]
  private_dns_enabled = true

  tags = {
    Name        = "${var.project_name}-vpce-rekognition-privatelink"
    Environment = var.environment
  }
}

# 7. Security Group cho Lambda functions ben trong VPC
resource "aws_security_group" "lambda_vpc_sg" {
  name        = "${var.project_name}-sg-lambda-vpc-${var.environment}"
  description = "Security group cho Lambda trong Private Subnet giao tiep VPC Endpoints"
  vpc_id      = aws_vpc.main.id

  egress {
    description = "Cho phep egress toi HTTPS Endpoints (S3, DynamoDB, Rekognition)"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project_name}-sg-lambda-vpc"
    Environment = var.environment
  }
}
