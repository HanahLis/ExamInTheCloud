terraform {
  required_version = ">= 1.5.0"

  backend "s3" {
    bucket  = "cloudexam-tfstate-409289618109-dev"
    key     = "dev/terraform.tfstate"
    region  = "ap-southeast-1"
    encrypt = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.4"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "CloudExam"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Tenant      = "MultiTenant"
      CostCenter  = "FinOps-0USD"
      Owner       = "TuanPhong"
    }
  }
}

