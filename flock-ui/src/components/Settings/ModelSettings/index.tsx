import { Box, Text, Group, Stack, Loader } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import ProviderSettings from './ProviderSettings';
import CustomModelSettings from './CustomModelSettings';
import { ProviderCard } from './components/ProviderCard';
import { DefaultModelCard } from './components/DefaultModelCard';
import { SummaryModelCard } from './components/SummaryModelCard';
import { useModelSettings } from './hooks/useModelSettings';

export default function ModelProviderPage() {
  const { t } = useTranslation();

  const {
    providers,
    modelsMap,
    expanded,
    loading,
    editingProvider,
    setEditingProvider,
    addingCustomModel,
    setAddingCustomModel,
    testingProvider,
    testResult,
    connectedProviders,
    onlineModels,
    summaryModels,
    selectedDefaultValue,
    selectedSummaryValue,
    toggleExpand,
    handleTestConnection,
    handleToggleOnline,
    handleDeleteModel,
    handleDefaultModelChange,
    handleSummaryModelChange,
    loadData,
    setExpanded,
  } = useModelSettings();

  if (loading) {
    return (
      <Box style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
        <Loader size="md" color="blue" />
      </Box>
    );
  }

  return (
    <Stack gap="xl" p={12}>
      <DefaultModelCard
        t={t}
        onlineModels={onlineModels}
        value={selectedDefaultValue}
        onChange={handleDefaultModelChange}
      />

      <SummaryModelCard
        t={t}
        summaryModels={summaryModels}
        value={selectedSummaryValue}
        onChange={handleSummaryModelChange}
        disabled={onlineModels.length === 0}
      />

      {providers.map((provider) => (
        <ProviderCard
          key={provider.id}
          provider={provider}
          models={modelsMap[provider.id] || []}
          isExpanded={expanded[provider.id] || false}
          toggleExpand={toggleExpand}
          connectedProviders={connectedProviders}
          testingProvider={testingProvider}
          testResult={testResult}
          handleTestConnection={handleTestConnection}
          setEditingProvider={setEditingProvider}
          setAddingCustomModel={setAddingCustomModel}
          setExpanded={setExpanded}
          handleDeleteModel={handleDeleteModel}
          handleToggleOnline={handleToggleOnline}
          t={t}
        />
      ))}

      {editingProvider && (
        <ProviderSettings
          provider={editingProvider}
          onClose={() => setEditingProvider(null)}
          onSaved={loadData}
        />
      )}

      {addingCustomModel && (
        <CustomModelSettings
          provider={addingCustomModel.provider}
          model={addingCustomModel.model}
          onClose={() => setAddingCustomModel(null)}
          onSaved={loadData}
        />
      )}
    </Stack>
  );
}
