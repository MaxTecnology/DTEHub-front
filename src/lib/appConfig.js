import logoLightDefault from '@/assets/logo.png'
import logoDarkDefault from '@/assets/logo-branca.png'

/**
 * Configuração da aplicação via variáveis de ambiente.
 *
 * Para usar em outra empresa:
 *  1. Coloque os arquivos de logo em public/ (ex: public/logo-light.png, public/logo-dark.png)
 *  2. Configure as variáveis no .env:
 *       VITE_APP_NAME=Outra Empresa
 *       VITE_APP_LOGO_LIGHT=/logo-light.png
 *       VITE_APP_LOGO_DARK=/logo-dark.png
 */
export const appConfig = {
  name: import.meta.env.VITE_APP_NAME ?? 'G2A Soluções Contábeis',
  logoLight: import.meta.env.VITE_APP_LOGO_LIGHT ?? logoLightDefault,
  logoDark: import.meta.env.VITE_APP_LOGO_DARK ?? logoDarkDefault,
}
