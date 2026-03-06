import { FormEvent, useEffect, useState } from "react"
import { LockKeyhole } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import { authMessages } from "@/lib/i18n"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function LoginDialog() {
  const [password, setPassword] = useState("")
  const { locale } = useI18n()
  const text = authMessages[locale]
  const {
    loginDialogOpen,
    loginSubmitting,
    loginError,
    authIntentPath,
    closeLoginDialog,
    login,
  } = useAuth()

  useEffect(() => {
    if (!loginDialogOpen) {
      setPassword("")
    }
  }, [loginDialogOpen])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const result = await login(password)
    if (result.ok) {
      setPassword("")
    }
  }

  return (
    <Dialog
      open={loginDialogOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !loginSubmitting) {
          closeLoginDialog()
        }
      }}
    >
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <LockKeyhole className="h-5 w-5 text-primary" />
            {text.title}
          </DialogTitle>
          <DialogDescription>
            {authIntentPath ? text.descriptionWithPath(authIntentPath) : text.description}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            autoFocus
            placeholder={text.passwordPlaceholder}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={loginSubmitting}
          />
          {loginError ? <p className="text-sm text-destructive">{loginError}</p> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeLoginDialog} disabled={loginSubmitting}>
              {text.cancel}
            </Button>
            <Button type="submit" disabled={loginSubmitting}>
              {loginSubmitting ? text.submitting : text.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
