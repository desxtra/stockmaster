variable "vpc_cidr" {
    type = string
    default = "10.180.0.0/16"
}

variable "pub1_cidr" {
    type = string
    default = "10.180.1.0/24"
}

variable "pub2_cidr" {
    type = string
    default = "10.180.2.0/24"
}

variable "priv1_cidr" {
    type = string
    default = "10.180.10.0/24"
}

variable "priv2_cidr" {
    type = string
    default = "10.180.11.0/24"
}

variable "avzoneA" {
    type = string
    default = "us-east-1a"
}

variable "avzoneB" {
    type = string
    default = "us-east-1b"
}

variable "db_user" {
    type = string
    default = "stockmaster_admin"
}

variable "db_pw" {
    type = string
    default = "stockmaster-db-secret"
}