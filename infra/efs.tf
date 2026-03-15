resource "aws_efs_file_system" "efs" {
  creation_token = "stockmaster-efs"
  lifecycle_policy {
    transition_to_ia = "AFTER_30_DAYS"
  }
}

resource "aws_efs_mount_target" "efs_mt1" {
  file_system_id = aws_efs_file_system.efs.id
  security_groups = [aws_security_group.efs.id]
  subnet_id      = aws_subnet.priv1.id
}

resource "aws_efs_mount_target" "efs_mt2" {
  file_system_id = aws_efs_file_system.efs.id
  security_groups = [aws_security_group.efs.id]
  subnet_id      = aws_subnet.priv2.id
}

resource "aws_efs_access_point" "ap1" {
  file_system_id = aws_efs_file_system.efs.id

  root_directory {
    creation_info {
        owner_gid = 1001
        owner_uid = 1001
        permissions = "0755"
    }

    path = "exports"
  }
}

resource "aws_efs_access_point" "ap2" {
  file_system_id = aws_efs_file_system.efs.id

  root_directory {
    creation_info {
        owner_gid = 1001
        owner_uid = 1001
        permissions = "0755"
    }

    path = "uploads"
  }
}