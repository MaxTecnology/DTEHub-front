import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard,
  Building2,
  Briefcase,
  Bell,
  Users,
  ShieldCheck,
  LogOut,
  Sun,
  Moon,
} from 'lucide-react'
import { appConfig } from '@/lib/appConfig'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/store/theme'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

const ROLE_WEIGHT = { owner: 4, admin: 3, operator: 2, viewer: 1 }

function hasRole(userRole, minRole) {
  return (ROLE_WEIGHT[userRole] ?? 0) >= (ROLE_WEIGHT[minRole] ?? 0)
}

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, minRole: 'viewer' },
  { to: '/companies', label: 'Empresas', icon: Building2, minRole: 'viewer' },
  { to: '/jobs', label: 'Jobs', icon: Briefcase, minRole: 'operator' },
  { to: '/alerts', label: 'Alertas', icon: Bell, minRole: 'operator' },
]

const adminItems = [
  { to: '/admin/users', label: 'Usuários', icon: Users, minRole: 'admin' },
  { to: '/admin/certificates', label: 'Certificados', icon: ShieldCheck, minRole: 'admin' },
]

function getInitials(email) {
  if (!email) return '?'
  const name = email.split('@')[0]
  const parts = name.split(/[._-]/).filter(Boolean)
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}

export default function AppLayout() {
  const { user, role, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="flex w-56 flex-shrink-0 flex-col border-r bg-sidebar">
        <div className="flex h-14 items-center px-5">
          <img src={appConfig.logoDark} alt={appConfig.name} className="h-7" />
        </div>

        <Separator className="bg-sidebar-border" />

        <nav className="flex-1 space-y-0.5 px-2 py-3">
          {navItems
            .filter((item) => hasRole(role, item.minRole))
            .map((item) => (
              <SidebarLink key={item.to} {...item} />
            ))}

          {hasRole(role, 'admin') && (
            <>
              <div className="px-2 pt-4 pb-1">
                <p className="text-xs font-medium uppercase tracking-wider text-sidebar-foreground/40">
                  Admin
                </p>
              </div>
              {adminItems.map((item) => (
                <SidebarLink key={item.to} {...item} />
              ))}
            </>
          )}
        </nav>

        <Separator className="bg-sidebar-border" />

        {/* Rodape com usuario */}
        <div className="flex items-center gap-2.5 px-3 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/20 text-sidebar-primary text-xs font-bold select-none">
            {getInitials(user?.email)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-sidebar-foreground">
              {user?.email ?? '—'}
            </p>
            <p className="text-xs capitalize text-sidebar-foreground/50">{role}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={signOut}
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </aside>

      {/* Conteudo principal */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

function SidebarLink({ to, label, icon: Icon }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors',
          isActive
            ? 'bg-sidebar-primary/15 text-sidebar-primary font-semibold'
            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{label}</span>
    </NavLink>
  )
}
