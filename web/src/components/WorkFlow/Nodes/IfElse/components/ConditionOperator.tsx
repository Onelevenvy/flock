import React from 'react';
import { Select } from '@chakra-ui/react';
import { ComparisonOperator } from '../../../types';

interface ConditionOperatorProps {
  value?: ComparisonOperator;
  onSelect: (value: ComparisonOperator) => void;
}

const ConditionOperator: React.FC<ConditionOperatorProps> = ({
  value,
  onSelect,
}) => {
  return (
    <Select
      value={value}
      onChange={(e) => onSelect(e.target.value as ComparisonOperator)}
      size="sm"
      w="150px"
    >
      <option value={ComparisonOperator.equal}>=</option>
      <option value={ComparisonOperator.notEqual}>≠</option>
      <option value={ComparisonOperator.contains}>Contains</option>
      <option value={ComparisonOperator.notContains}>Not Contains</option>
      <option value={ComparisonOperator.startWith}>Starts With</option>
      <option value={ComparisonOperator.endWith}>Ends With</option>
      <option value={ComparisonOperator.largerThan}>&gt;</option>
      <option value={ComparisonOperator.lessThan}>&lt;</option>
      <option value={ComparisonOperator.largerThanOrEqual}>≥</option>
      <option value={ComparisonOperator.lessThanOrEqual}>≤</option>
      <option value={ComparisonOperator.empty}>Empty</option>
      <option value={ComparisonOperator.notEmpty}>Not Empty</option>
    </Select>
  );
};

export default ConditionOperator; 