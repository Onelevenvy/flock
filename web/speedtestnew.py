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
        f"  Number of groups: {results_dict['num_groups']}",
        f"  Images per group: {results_dict['images_per_group']}",
        "-" * 30
    ]
    return "\n".join(output_lines) + "\n"


def inference_worker(predictor, model_name, img, image_interval=0):
    """单个推理任务的工作函数"""
    try:
        if image_interval > 0:
            time.sleep(image_interval)  # 每张图片之间的间隔
        start_time = time.perf_counter()
        res = predictor.predict(image=img, model_name=model_name)
        end_time = time.perf_counter()
        return (end_time - start_time) * 1000  # 转换为毫秒
    except Exception as e:
        print(f"Error during prediction: {e}")
        return None


def run_group_inference(predictor, model_name, img, num_inferences, num_threads, image_interval):
    """运行一组推理任务"""
    with ThreadPoolExecutor(max_workers=num_threads) as executor:
        futures = []
        for _ in range(num_inferences):
            future = executor.submit(inference_worker, predictor, model_name, img, image_interval)
            futures.append(future)
        
        results = []
        for future in futures:
            result = future.result()
            if result is not None:
                results.append(result)
        return results


def run_speed_test_once(model_path, img_path, fp16_load, test_description, 
                       num_threads=1, total_inferences=1000, num_groups=10,
                       image_interval=0, group_interval=2,
                       warmup=100, cooldown=50):
    """
    运行单次速度测试配置并返回结果
    Args:
        model_path: 模型路径
        img_path: 图片路径
        fp16_load: 是否使用FP16加载
        test_description: 测试描述
        num_threads: 线程数量
        total_inferences: 总推理次数
        num_groups: 分组数量
        image_interval: 每张图片之间的间隔时间(秒)
        group_interval: 每组之间的间隔时间(秒)
        warmup: 预热次数
        cooldown: 冷却次数
    """
    print(f"\nRunning: {test_description}")
    print(f"Model: {model_path}")
    print(f"Image: {img_path}")
    print(f"Configuration:")
    print(f"  - FP16 Load: {fp16_load}")
    print(f"  - Threads: {num_threads}")
    print(f"  - Total inferences: {total_inferences}")
    print(f"  - Number of groups: {num_groups}")
    print(f"  - Image interval: {image_interval}s")
    print(f"  - Group interval: {group_interval}s")

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

    individual_times_ms = []
    inferences_per_group = total_inferences // num_groups

    print(f"Starting {total_inferences} inferences in {num_groups} groups...")
    overall_start_time = time.perf_counter()
    
    for group in range(num_groups):
        print(f"Running group {group + 1}/{num_groups}...")
        group_results = run_group_inference(
            predictor=predictor,
            model_name=model_name,
            img=img,
            num_inferences=inferences_per_group,
            num_threads=num_threads,
            image_interval=image_interval
        )
        individual_times_ms.extend(group_results)
        
        if group < num_groups - 1:  # 如果不是最后一组，则等待组间隔时间
            print(f"Group {group + 1} completed. Waiting {group_interval}s before next group...")
            time.sleep(group_interval)

    overall_end_time = time.perf_counter()
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
            "num_groups": num_groups,
            "images_per_group": inferences_per_group,
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
        "num_threads": num_threads,
        "num_groups": num_groups,
        "images_per_group": inferences_per_group
    }

    print(f"Results for {test_description}:")
    print(f"  Max/Min/Avg (stable, ms): {results['max_tttt']:.2f} / {results['min_tttt']:.2f} / {results['avg_tttt']:.2f}")
    print(f"  Total time: {results['total_time']:.2f}s, Throughput: {results['throughput']:.2f} inf/s")
    print(f"  Avg total per inf: {results['avg_time_per_inference'] * 1000:.2f} ms")
    print(f"  Threads: {num_threads}, Groups: {num_groups}, Images per group: {inferences_per_group}")

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
TOTAL_INFERENCES = 1000  # 总推理次数
NUM_GROUPS = 10  # 分组数量
IMAGE_INTERVAL = 0.1  # 每张图片间隔时间(秒)
GROUP_INTERVAL = 2  # 每组间隔时间(秒)
WARMUP_INFERENCES = 100
COOLDOWN_INFERENCES = 50
REST_TIME_SEC = 10
OUTPUT_FILENAME = "speed_test_results_grouped.txt"

if __name__ == '__main__':
    all_results_summary = []

    with open(OUTPUT_FILENAME, "w", encoding="utf-8") as f_out:
        f_out.write(f"Speed Test Report - {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
        f_out.write(f"Configuration:\n")
        f_out.write(f"  - Threads: {NUM_THREADS}\n")
        f_out.write(f"  - Total inferences: {TOTAL_INFERENCES}\n")
        f_out.write(f"  - Number of groups: {NUM_GROUPS}\n")
        f_out.write(f"  - Images per group: {TOTAL_INFERENCES // NUM_GROUPS}\n")
        f_out.write(f"  - Image interval: {IMAGE_INTERVAL}s\n")
        f_out.write(f"  - Group interval: {GROUP_INTERVAL}s\n")
        f_out.write(f"  - Warmup: {WARMUP_INFERENCES}, Cooldown: {COOLDOWN_INFERENCES}\n\n")

        for i, group_config in enumerate(TEST_GROUPS):
            print(f"\n{'=' * 10} Starting Test Group: {group_config['name']} {'=' * 10}")
            f_out.write(f"\n{'=' * 10} Test Group: {group_config['name']} {'=' * 10}\n")
            f_out.write(f"Image: {group_config['img_path']}\n")

            # Test 1: PTH model, fp16=False (Normal)
            if group_config["pth_model"]:
                desc = f"{group_config['name']} - PTH (FP32 Load)"
                results = run_speed_test_once(
                    model_path=group_config["pth_model"],
                    img_path=group_config["img_path"],
                    fp16_load=False,
                    test_description=desc,
                    num_threads=NUM_THREADS,
                    total_inferences=TOTAL_INFERENCES,
                    num_groups=NUM_GROUPS,
                    image_interval=IMAGE_INTERVAL,
                    group_interval=GROUP_INTERVAL,
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
                    total_inferences=TOTAL_INFERENCES,
                    num_groups=NUM_GROUPS,
                    image_interval=IMAGE_INTERVAL,
                    group_interval=GROUP_INTERVAL,
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
                    total_inferences=TOTAL_INFERENCES,
                    num_groups=NUM_GROUPS,
                    image_interval=IMAGE_INTERVAL,
                    group_interval=GROUP_INTERVAL,
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
                f"{res_dict['description']}: "
                f"Avg Time={res_dict['avg_tttt']:.2f} ms, "
                f"Throughput={res_dict['throughput']:.2f} inf/s, "
                f"Threads={res_dict['num_threads']}, "
                f"Groups={res_dict['num_groups']}")
        else:
            print("A test failed or was skipped.") 