export interface DashboardMessages {
  hero: {
    badge: string
    titleLead: string
    titleHighlight: string
    subtitle: string
    ctaTrial: string
    ctaDocs: string
    stats: Array<{
      label: string
      value: string
    }>
  }
  storage: {
    titleLead: string
    titleHighlight: string
    subtitle: string
    uploadFiles: string
    storage: string
    used: string
    usedValue: string
    available: string
    quickAccess: string
    quickAccessItems: Array<{
      label: string
      count: number
    }>
    allFiles: string
    actions: {
      download: string
      share: string
      star: string
      delete: string
    }
    modifiedTimes: {
      hours2: string
      day1: string
      days3: string
      week1: string
      weeks2: string
    }
  }
  features: {
    badge: string
    titleLead: string
    titleHighlight: string
    subtitle: string
    learnMore: string
    items: Array<{
      title: string
      description: string
    }>
  }
  pricing: {
    badge: string
    titleLead: string
    titleHighlight: string
    subtitle: string
    popularBadge: string
    month: string
    trustPrefix: string
    trustCount: string
    trustSuffix: string
    plans: Array<{
      name: string
      price: string
      isCustom: boolean
      description: string
      features: string[]
      cta: string
      popular: boolean
    }>
  }
  footer: {
    description: string
    sections: {
      product: {
        title: string
        links: string[]
      }
      company: {
        title: string
        links: string[]
      }
      resources: {
        title: string
        links: string[]
      }
      legal: {
        title: string
        links: string[]
      }
    }
    copyright: string
    bottomLinks: {
      privacyPolicy: string
      termsOfService: string
      cookies: string
    }
  }
}
