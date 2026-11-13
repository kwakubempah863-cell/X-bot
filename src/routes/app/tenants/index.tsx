import { createFileRoute } from '@tanstack/react-router'
import { TenantsPage } from '@/components/tenants-page'

export const Route = createFileRoute('/app/tenants/')({
  head: () => ({
    meta: [
      { title: 'Tenants · Velvet Devil' },
      { name: 'description', content: 'Manage paired X bots.' }
    ]
  }),
  component: TenantsPage
})