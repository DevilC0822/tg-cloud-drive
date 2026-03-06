import { Toaster as Sonner, ToasterProps } from 'sonner'
import { useAppTheme } from '@/hooks/use-app-theme'

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useAppTheme()

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
