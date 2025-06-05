import time
import os
from concurrent.futures import ThreadPoolExecutor
from numpy.ma.extras import average  

from samsun.utils import cv2_read_img
from detect.predictor import Predictor


def format_results(results_dict):
    if results_dict is None:
        return "Test failed or skipped.\n"

    output_lines = [
        f"Test: {results_dict['description']}",
        f"  Max inference time (P50-P95): {results_dict['max_tttt']:.2f} ms",
        f"  Min inference time (P50-P95): {results_dict['min_tttt']:.2f} ms", 
        f"  Avg inference time (P50-P95): {results_dict['avg_tttt']:.2f} ms",
        f"  Total time for {results_dict['total_inferences']} inferences: {results_dict['total_time']:.2f} s",
        f"  Throughput: {results_dict['throughput']:.2f} inferences/sec",
        f"  Overall average time per inference: {results_dict['avg_time_per_inference'] * 1000:.2f} ms",
        f"  Number of threads: {results_dict['num_threads']}",
        "-" * 30
    ]
    return "\n".join(output_lines) + "\n"


def inference_worker(predictor, model_name, img):
    """单个推理任务的工作函数"""
    try:
        start_time = time.time()
        res = predictor.predict(image=img, model_name=model_name)
        end_time = time.time()
        return (end_time - start_time) * 1000  # 转换为毫秒
    except Exception as e:
        print(f"Error during prediction: {e}")
        return None


def run_speed_test_once(model_path, img_path, fp16_load, test_description, num_threads=1, num_inferences=1000, warmup=100,
                        cooldown=50):
    """
    运行单次速度测试配置并返回结果
    Args:
        model_path: 模型路径
        img_path: 图片路径
        fp16_load: 是否使用FP16加载
        test_description: 测试描述
        num_threads: 线程数量
        num_inferences: 每个线程的推理次数
        warmup: 预热次数
        cooldown: 冷却次数
    """
    print(f"\nRunning: {test_description}")
    print(f"Model: {model_path}, Image: {img_path}, FP16 Load: {fp16_load}, Threads: {num_threads}")

    if not os.path.exists(model_path):
        print(f"Error: Model path not found: {model_path}")
        return None
    if not os.path.exists(img_path):
        print(f"Error: Image path not found: {img_path}")
        return None

    try:
        img = cv2_read_img(img_path)
        if img is None:
            print(f"Error: Could not read image: {img_path}")
            return None

        predictor = Predictor()
        model_name = predictor.load_model(model_path=model_path, fp16=fp16_load,
                                          semaphores_preprocess=4,
                                          semaphores_model=1)
        if model_name is None:
            print(f"Error: Failed to load model: {model_path}")
            return None
        print(f"Model '{model_name}' loaded successfully.")

    except Exception as e:
        print(f"Error during setup for {test_description}: {e}")
        return None

    total_inferences = num_inferences * num_threads
    individual_times_ms = []

    print(f"Starting {total_inferences} inferences with {num_threads} threads...")
    overall_start_time = time.time()
    
    with ThreadPoolExecutor(max_workers=num_threads) as executor:
        # 为每个线程创建num_inferences个任务
        futures = []
        for _ in range(total_inferences):
            future = executor.submit(inference_worker, predictor, model_name, img)
            futures.append(future)
        
        # 收集所有结果
        for future in futures:
            result = future.result()
            if result is not None:
                individual_times_ms.append(result)

    overall_end_time = time.time()
    total_run_time_sec = overall_end_time - overall_start_time

    if len(individual_times_ms) < warmup + cooldown + 1:
        print(f"Warning: Not enough data points for {test_description}. Collected {len(individual_times_ms)}")
        if not individual_times_ms: return None
        stable_times_ms = individual_times_ms
    else:
        stable_times_ms = individual_times_ms[warmup: total_inferences - cooldown]

    if not stable_times_ms:
        print(f"Warning: No stable inference times recorded for {test_description}.")
        return {
            "description": test_description,
            "max_tttt": 0,
            "min_tttt": 0,
            "avg_tttt": 0,
            "total_time": total_run_time_sec,
            "throughput": total_inferences / total_run_time_sec if total_run_time_sec > 0 else 0,
            "avg_time_per_inference": total_run_time_sec / total_inferences if total_inferences > 0 else 0,
            "total_inferences": total_inferences,
            "num_threads": num_threads,
            "notes": "No stable inference times."
        }

    avg_stable_time = average(stable_times_ms)

    results = {
        "description": test_description,
        "max_tttt": max(stable_times_ms),
        "min_tttt": min(stable_times_ms),
        "avg_tttt": float(avg_stable_time),
        "total_time": total_run_time_sec,
        "throughput": total_inferences / total_run_time_sec if total_run_time_sec > 0 else 0,
        "avg_time_per_inference": total_run_time_sec / total_inferences if total_inferences > 0 else 0,
        "total_inferences": total_inferences,
        "num_threads": num_threads
    }

    print(f"Results for {test_description}:")
    print(
        f"  Max/Min/Avg (stable, ms): {results['max_tttt']:.2f} / {results['min_tttt']:.2f} / {results['avg_tttt']:.2f}")
    print(
        f"  Total time: {results['total_time']:.2f}s, Throughput: {results['throughput']:.2f} inf/s, Avg total per inf: {results['avg_time_per_inference'] * 1000:.2f} ms")
    print(f"  Threads: {num_threads}, Total inferences: {total_inferences}")

    return results


TEST_GROUPS = [
    {
        "name": "LT-1000w",
        "pth_model": r"C:\Users\Administrator\Desktop\qua\LT-1000w\model\LT-1000w_V001_1031\LT-1000w.pth",
        "engine_model": r"C:\Users\Administrator\Desktop\qua\LT-1000w\model\LT-1000w_V001_1031\LT-1000w\end2end.engine",
        "img_path": r"C:\Users\Administrator\Desktop\qua\LT-1000w\sample\1 - 副本 (2).bmp"
    }
]

# 配置参数
NUM_THREADS = 4  # 线程数
NUM_INFERENCES_PER_THREAD = 1000  # 每个线程的推理次数
WARMUP_INFERENCES = 100
COOLDOWN_INFERENCES = 50
REST_TIME_SEC = 10
OUTPUT_FILENAME = "speed_test_results.txt"

if __name__ == '__main__':
    all_results_summary = []

    with open(OUTPUT_FILENAME, "w", encoding="utf-8") as f_out:
        f_out.write(f"Speed Test Report - {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
        f_out.write(
            f"Threads: {NUM_THREADS}, Inferences per Thread: {NUM_INFERENCES_PER_THREAD}\n")
        f_out.write(
            f"Total Inferences per Test: {NUM_THREADS * NUM_INFERENCES_PER_THREAD} (Warmup: {WARMUP_INFERENCES}, Cooldown: {COOLDOWN_INFERENCES})\n\n")

        for i, group_config in enumerate(TEST_GROUPS):
            print(f"\n{'=' * 10} Starting Test Group: {group_config['name']} {'=' * 10}")
            f_out.write(
                f"\n{'=' * 10} Test Group: {group_config['name']} {'=' * 10}\nImage: {group_config['img_path']}\n")

            # Test 1: PTH model, fp16=False (Normal)
            if group_config["pth_model"]:
                desc = f"{group_config['name']} - PTH (FP32 Load)"
                results = run_speed_test_once(
                    model_path=group_config["pth_model"],
                    img_path=group_config["img_path"],
                    fp16_load=False,
                    test_description=desc,
                    num_threads=NUM_THREADS,
                    num_inferences=NUM_INFERENCES_PER_THREAD,
                    warmup=WARMUP_INFERENCES,
                    cooldown=COOLDOWN_INFERENCES
                )
                all_results_summary.append(results)
                formatted_str = format_results(results)
                print(formatted_str)
                f_out.write(formatted_str)
            else:
                print(f"Skipping PTH (FP32 Load) for {group_config['name']} - No PTH model path provided.")
                f_out.write(f"Skipping PTH (FP32 Load) for {group_config['name']} - No PTH model path provided.\n")

            # Test 2: PTH model, fp16=True
            if group_config["pth_model"]:
                desc = f"{group_config['name']} - PTH (FP16 Load)"
                results = run_speed_test_once(
                    model_path=group_config["pth_model"],
                    img_path=group_config["img_path"],
                    fp16_load=True,
                    test_description=desc,
                    num_threads=NUM_THREADS,
                    num_inferences=NUM_INFERENCES_PER_THREAD,
                    warmup=WARMUP_INFERENCES,
                    cooldown=COOLDOWN_INFERENCES
                )
                all_results_summary.append(results)
                formatted_str = format_results(results)
                print(formatted_str)
                f_out.write(formatted_str)
            else:
                print(f"Skipping PTH (FP16 Load) for {group_config['name']} - No PTH model path provided.")
                f_out.write(f"Skipping PTH (FP16 Load) for {group_config['name']} - No PTH model path provided.\n")

            # Test 3: Engine model
            if group_config["engine_model"]:
                desc = f"{group_config['name']} - Engine"
                results = run_speed_test_once(
                    model_path=group_config["engine_model"],
                    img_path=group_config["img_path"],
                    fp16_load=False,
                    test_description=desc,
                    num_threads=NUM_THREADS,
                    num_inferences=NUM_INFERENCES_PER_THREAD,
                    warmup=WARMUP_INFERENCES,
                    cooldown=COOLDOWN_INFERENCES
                )
                all_results_summary.append(results)
                formatted_str = format_results(results)
                print(formatted_str)
                f_out.write(formatted_str)
            else:
                print(f"Skipping Engine test for {group_config['name']} - No Engine model path provided.")
                f_out.write(f"Skipping Engine test for {group_config['name']} - No Engine model path provided.\n")

            if i < len(TEST_GROUPS) - 1:
                print(f"\n--- Group '{group_config['name']}' finished. Resting for {REST_TIME_SEC} seconds... ---")
                f_out.write(f"\n--- Resting for {REST_TIME_SEC} seconds before next group... ---\n")
                time.sleep(REST_TIME_SEC)

        print(f"\n{'=' * 10} All tests completed. Results saved to {OUTPUT_FILENAME} {'=' * 10}")
        f_out.write(f"\n{'=' * 10} All tests completed {'=' * 10}\n")

    print("\nSummary of all tests:")
    for res_dict in all_results_summary:
        if res_dict:
            print(
                f"{res_dict['description']}: Avg Stable Time={res_dict['avg_tttt']:.2f} ms, "
                f"Throughput={res_dict['throughput']:.2f} inf/s, Threads={res_dict['num_threads']}")
        else:
            print("A test failed or was skipped.")