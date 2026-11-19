# One-time cleanup: removes legacy GTM / Partner Management stubs and unused files (run from the project folder).
#   powershell -ExecutionPolicy Bypass -File scripts\cleanup.ps1
$files = @(
  'src\App.css',
  'src\components\common\ConfirmModal.tsx',
  'src\components\gtm\ChannelsRoutesTab.tsx',
  'src\components\gtm\CommercialTermsTab.tsx',
  'src\components\gtm\GTMOverviewDashboard.tsx',
  'src\components\gtm\PartnerClassificationTab.tsx',
  'src\components\gtm\SalesChannelsTab.tsx',
  'src\components\gtm\TerritoriesTab.tsx',
  'src\components\gtm\TerritoryDrawer.tsx',
  'src\components\partner\InvitePartnerModal.tsx',
  'src\components\partner\PartnerDetailsModal.tsx',
  'src\components\partner\PartnerFormModal.tsx',
  'src\components\partner\PartnerList.tsx',
  'src\components\partner\PartnerOnboardingWizard.tsx',
  'src\components\partner\TerritoryAssignmentModal.tsx',
  'src\components\routes\RouteBuilderDrawer.tsx',
  'src\components\routes\RouteDetailDrawer.tsx',
  'src\components\routes\RoutesOverview.tsx',
  'src\data\gtmData.ts',
  'src\data\partnerData.ts',
  'src\modules\gtm-v2\pages\configuration\sections\PaymentModesSection.tsx',
  'src\modules\gtm-v2\pages\partner-onboarding\RouteBuilder.tsx',
  'src\modules\gtm-v2\pages\partner-onboarding\StepFlows.tsx',
  'src\modules\gtm-v2\pages\partner-onboarding\StepMapping.tsx',
  'src\modules\gtm-v2\pages\sales-flow-topology\FlowCanvas.tsx',
  'src\pages\GTMConfigurationPage.tsx',
  'src\pages\PartnerManagementPage.tsx',
  'src\types\gtm.ts',
  'src\types\partner.ts'
)
foreach ($f in $files) { if (Test-Path $f) { Remove-Item $f; Write-Host "removed $f" } }
foreach ($d in @("src\components\gtm","src\components\partner","src\components\routes")) { if ((Test-Path $d) -and -not (Get-ChildItem $d)) { Remove-Item $d; Write-Host "removed folder $d" } }
Write-Host "Cleanup done."
