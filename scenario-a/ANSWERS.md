### Task 3 Explanation

Deleting a file in Linux is controlled mainly by the parent directory's permissions, not by the file's own permissions. Since Carol owns the `backups` directory, the sticky bit alone could not stop her from deleting files.

To satisfy the requirement, the backup files were marked as **immutable** using `chattr +i`. This prevents modification or deletion of the backup files until the immutable flag is removed by root.
