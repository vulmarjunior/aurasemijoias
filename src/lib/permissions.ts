export type PerfilTipo = 'ADMIN' | 'USER' | 'VIEWER'

export function isAdmin(perfil?: PerfilTipo | null): boolean {
  return perfil === 'ADMIN'
}

export function isUser(perfil?: PerfilTipo | null): boolean {
  return perfil === 'USER'
}

export function isViewer(perfil?: PerfilTipo | null): boolean {
  return perfil === 'VIEWER'
}

export function canEdit(perfil?: PerfilTipo | null): boolean {
  return perfil === 'ADMIN' || perfil === 'USER'
}

export function canDelete(perfil?: PerfilTipo | null): boolean {
  return perfil === 'ADMIN' || perfil === 'USER'
}

export function canManageUsers(perfil?: PerfilTipo | null): boolean {
  return perfil === 'ADMIN'
}
