import { createFileRoute } from '@tanstack/react-router'
import { TenantDetail } from '@/components/tenant-detail'

export const Route = createFileRoute('/app/tenants/$tenantId')({
  head: () => ({
    meta: [
      { title: 'Tenant detail · Velvet Devil' },
      { name: 'description', content: 'Live tenant telemetry.' }
    ]
  }),
  component: TenantDetailRoute
})

function TenantDetailRoute() {
  const { tenantId } = Route.useParams()

  return <TenantDetail tenantId={tenantId} />
}