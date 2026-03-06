package store

const (
	sqlTrue                  = "1=1"
	vaultDescendantExistsSQL = "EXISTS (SELECT 1 FROM items d WHERE d.in_vault = TRUE AND d.path LIKE i.path || '/%')"
	vaultFolderVisibleSQL    = "(i.in_vault = TRUE OR " + vaultDescendantExistsSQL + ")"
	vaultItemVisibleSQL      = "((i.type <> 'folder' AND i.in_vault = TRUE) OR (i.type = 'folder' AND " + vaultFolderVisibleSQL + "))"
)
