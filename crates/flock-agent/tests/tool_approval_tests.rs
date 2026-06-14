use flock_core::ipc_interface::approval::{ToolApprovalManager, ApprovalScope, ToolApprovalResult};
use std::sync::Arc;

#[tokio::test(flavor = "multi_thread")]
async fn test_agent_tool_approval() {
    let approval_manager = Arc::new(ToolApprovalManager::new());
    let call_id = "call_xyz123";
    let category = flock_core::ipc_interface::events::ToolCategory::Info;
    
    // 1. 请求审批 (返回 oneshot::Receiver)
    let rx = approval_manager.request_approval(call_id, &category);
    
    // 2. 模拟前端在后台同意该审批
    let approval_manager_clone = approval_manager.clone();
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
        approval_manager_clone.approve(call_id, ApprovalScope::Once, None);
    });
    
    // 3. 阻塞等待审批结果，断言返回的是 Approved
    let result = rx.await.unwrap();
    assert!(matches!(result, ToolApprovalResult::Approved { .. }));
}

#[tokio::test(flavor = "multi_thread")]
async fn test_agent_tool_deny() {
    let approval_manager = Arc::new(ToolApprovalManager::new());
    let call_id = "call_abc789";
    let category = flock_core::ipc_interface::events::ToolCategory::Exec;
    
    // 1. 请求审批
    let rx = approval_manager.request_approval(call_id, &category);
    
    // 2. 模拟被用户显式拒绝
    let approval_manager_clone = approval_manager.clone();
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
        approval_manager_clone.resolve(call_id, ToolApprovalResult::Denied {
            reason: "User rejected execution".to_string(),
        });
    });
    
    // 3. 断言结果是 Denied，且包含对应的拒绝原因
    let result = rx.await.unwrap();
    if let ToolApprovalResult::Denied { reason } = result {
        assert_eq!(reason, "User rejected execution");
    } else {
        panic!("Expected Denied result");
    }
}
