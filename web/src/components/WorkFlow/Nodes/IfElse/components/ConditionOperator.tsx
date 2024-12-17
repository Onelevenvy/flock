import React from 'react';
import { Select } from '@chakra-ui/react';
import { ComparisonOperator } from '../../../types';
import { useTranslation } from 'react-i18next';

interface ConditionOperatorProps {
  value?: ComparisonOperator;
  onSelect: (value: ComparisonOperator) => void;
}

const ConditionOperator: React.FC<ConditionOperatorProps> = ({
  value,
  onSelect,
}) => {
  const { t } = useTranslation();

  return (
    <Select
      value={value}
      onChange={(e) => onSelect(e.target.value as ComparisonOperator)}
      size="sm"
      w="150px"
      bg="white"
      borderColor="gray.200"
      _hover={{ borderColor: "blue.200" }}
      _focus={{
        borderColor: "blue.500",
        boxShadow: "0 0 0 1px var(--chakra-colors-blue-500)",
      }}
      transition="all 0.2s"
    >
      <option value={ComparisonOperator.contains}>{t("workflow.nodes.ifelse.operators.contains")}</option>
      <option value={ComparisonOperator.notContains}>{t("workflow.nodes.ifelse.operators.notContains")}</option>
      <option value={ComparisonOperator.startWith}>{t("workflow.nodes.ifelse.operators.startWith")}</option>
      <option value={ComparisonOperator.endWith}>{t("workflow.nodes.ifelse.operators.endWith")}</option>
      <option value={ComparisonOperator.equal}>{t("workflow.nodes.ifelse.operators.equal")}</option>
      <option value={ComparisonOperator.notEqual}>{t("workflow.nodes.ifelse.operators.notEqual")}</option>
      <option value={ComparisonOperator.empty}>{t("workflow.nodes.ifelse.operators.empty")}</option>
      <option value={ComparisonOperator.notEmpty}>{t("workflow.nodes.ifelse.operators.notEmpty")}</option>
    </Select>
  );
};

export default ConditionOperator; 