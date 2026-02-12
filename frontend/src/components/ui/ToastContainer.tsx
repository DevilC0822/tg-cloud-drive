import { Toast as HeroToast } from '@heroui/react';

export function ToastContainer() {
  return (
    <HeroToast.Provider
      placement="bottom start"
      maxVisibleToasts={4}
      width={360}
      className="z-50"
    />
  );
}
