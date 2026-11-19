import { useApp } from '../../../context/AppContext.tsx';

/**
 * GTM V2 authorization — derived from the EXISTING VinFlux user & permission model
 * (AppContext.currentUser.permissions), which comes from Users & Roles (src/modules/users).
 *
 * Mapping:
 *  - manageConfig        ← permissions.canManageConfig  (masters, flows, configuration)
 *  - approve             ← permissions.canApproveProducts (approval authority)
 *  - overrideCommercials ← permissions.canManageConfig
 *  - onboardPartners     ← always (any signed-in VinFlux user can raise onboarding)
 */
export const useGtmAuth = () => {
  const { currentUser, activePrincipal, showToast } = useApp();
  const p = currentUser.permissions;
  return {
    user: currentUser,
    actor: currentUser.name,
    principal: activePrincipal,
    can: {
      manageConfig: p.canManageConfig,
      approve: p.canApproveGtm ?? p.canApproveProducts,
      overrideCommercials: p.canManageConfig,
      onboardPartners: currentUser.matrix ? !!currentUser.matrix.gtm?.includes('edit') : true,
    },
    /** Territory scope of the signed-in user (empty = all territories). */
    territoryScope: currentUser.scope?.territoryIds ?? [],
    showToast,
  };
};
