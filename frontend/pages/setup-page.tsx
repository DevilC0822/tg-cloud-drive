import { SetupInitView } from "@/components/setup/setup-init-view"
import { SetupInitializedView } from "@/components/setup/setup-initialized-view"

interface SetupPageProps {
  initialized: boolean
  markInitialized: () => void
  refreshStatus: () => Promise<unknown>
}

export default function SetupPage(props: SetupPageProps) {
  if (props.initialized) {
    return <SetupInitializedView />
  }

  return (
    <SetupInitView
      markInitialized={props.markInitialized}
      refreshStatus={props.refreshStatus}
    />
  )
}
