import React from 'react';
import { Select } from '@chakra-ui/react';
import { ComparisonOperator } from '../../../types';
import { useTranslation } from 'react-i18next';

interface ConditionOperatorProps {
  value: ComparisonOperator;
  onSelect: (value: ComparisonOperator) => void;
  width?: string;
}

const ConditionOperator: React.FC<ConditionOperatorProps> = ({
  value,
  onSelect,
  width,
}) => {
  const { t } = useTranslation();

  return (
    <Select
      size="sm"
      value={value}
      onChange={(e) => onSelect(e.target.value as ComparisonOperator)}
      bg="white"
      borderColor="gray.200"
      _hover={{ borderColor: "blue.200" }}
      width={width}
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