import random

TASKS = {
    # ---------- LEVEL 1 ----------
    "reverse_string": {
        "level": 1,
        "title": "Reverse String",
        "description": "Развернуть строку.",
        "template": "def reverse(s):\n    # ваш код здесь\n    pass",
        "tests": [
            {"expr": 'reverse("abc")', "expected": "cba"},
            {"expr": 'reverse("hello")', "expected": "olleh"},
            {"expr": 'reverse("")', "expected": ""},
            {"expr": 'reverse("racecar")', "expected": "racecar"},
        ],
    },

    "sum_array": {
        "level": 1,
        "title": "Sum Array",
        "description": "Посчитать сумму чисел в массиве.",
        "template": "def sum_array(a):\n    # ваш код здесь\n    pass",
        "tests": [
            {"expr": "sum_array([1,2,3])", "expected": 6},
            {"expr": "sum_array([-1,1,0])", "expected": 0},
            {"expr": "sum_array([])", "expected": 0},
        ],
    },

    "is_palindrome": {
        "level": 1,
        "title": "Palindrome Check",
        "description": "Проверить, является ли строка палиндромом.",
        "template": "def is_palindrome(s):\n    # ваш код здесь\n    pass",
        "tests": [
            {"expr": 'is_palindrome("aba")', "expected": True},
            {"expr": 'is_palindrome("abc")', "expected": False},
            {"expr": 'is_palindrome("")', "expected": True},
        ],
    },

    "count_vowels": {
        "level": 1,
        "title": "Count Vowels",
        "description": "Посчитать количество гласных в строке.",
        "template": "def count_vowels(s):\n    # ваш код здесь\n    pass",
        "tests": [
            {"expr": 'count_vowels("hello")', "expected": 2},
            {"expr": 'count_vowels("xyz")', "expected": 0},
            {"expr": 'count_vowels("")', "expected": 0},
        ],
    },

    "max_of_three": {
        "level": 1,
        "title": "Max of Three",
        "description": "Вернуть максимум из трёх чисел.",
        "template": "def max_of_three(a, b, c):\n    # ваш код здесь\n    pass",
        "tests": [
            {"expr": "max_of_three(1,5,2)", "expected": 5},
            {"expr": "max_of_three(7,7,7)", "expected": 7},
            {"expr": "max_of_three(-1,-5,0)", "expected": 0},
        ],
    },

    # ---------- LEVEL 2 ----------
    "validate_parentheses": {
        "level": 2,
        "title": "Validate Parentheses",
        "description": "Проверить корректность скобочной строки.",
        "template": "def is_valid(s):\n    # ваш код здесь\n    pass",
        "tests": [
            {"expr": 'is_valid("()")', "expected": True},
            {"expr": 'is_valid("([])")', "expected": True},
            {"expr": 'is_valid("([)]")', "expected": False},
        ],
    },

    "two_sum": {
        "level": 2,
        "title": "Two Sum",
        "description": "Найти индексы двух чисел, сумма которых равна target.",
        "template": "def two_sum(nums, target):\n    # ваш код здесь\n    pass",
        "tests": [
            {"expr": "two_sum([2,7,11,15], 9)", "expected": [0,1]},
            {"expr": "two_sum([3,2,4], 6)", "expected": [1,2]},
        ],
    },

    "remove_duplicates": {
        "level": 2,
        "title": "Remove Duplicates",
        "description": "Удалить дубликаты из отсортированного массива.",
        "template": "def remove_duplicates(arr):\n    # ваш код здесь\n    pass",
        "tests": [
            {"expr": "remove_duplicates([1,1,2])", "expected": [1,2]},
            {"expr": "remove_duplicates([])", "expected": []},
        ],
    },

    "rotate_array": {
        "level": 2,
        "title": "Rotate Array",
        "description": "Повернуть массив на k шагов вправо.",
        "template": "def rotate(arr, k):\n    # ваш код здесь\n    pass",
        "tests": [
            {"expr": "rotate([1,2,3,4,5], 2)", "expected": [4,5,1,2,3]},
            {"expr": "rotate([1,2], 3)", "expected": [2,1]},
        ],
    },

    "longest_common_prefix": {
        "level": 2,
        "title": "Longest Common Prefix",
        "description": "Найти самый длинный общий префикс.",
        "template": "def lcp(arr):\n    # ваш код здесь\n    pass",
        "tests": [
            {"expr": "lcp(['flower','flow','flight'])", "expected": "fl"},
            {"expr": "lcp(['dog','racecar','car'])", "expected": ""},
        ],
    },

    # ---------- LEVEL 3 ----------
    "flatten_list": {
        "level": 3,
        "title": "Flatten List",
        "description": "Развернуть вложенный список.",
        "template": "def flatten(arr):\n    # ваш код здесь\n    pass",
        "tests": [
            {"expr": "flatten([1,[2,[3],4]])", "expected": [1,2,3,4]},
            {"expr": "flatten([])", "expected": []},
        ],
    },

    "max_subarray": {
        "level": 3,
        "title": "Max Subarray",
        "description": "Максимальная сумма подмассива (Kadane).",
        "template": "def max_subarray(arr):\n    # ваш код здесь\n    pass",
        "tests": [
            {"expr": "max_subarray([-2,1,-3,4,-1,2,1,-5,4])", "expected": 6},
            {"expr": "max_subarray([1,2,3])", "expected": 6},
        ],
    },

    "top_k": {
        "level": 3,
        "title": "Top K Frequent",
        "description": "Найти K самых частых элементов.",
        "template": "def top_k(nums, k):\n    # ваш код здесь\n    pass",
        "tests": [
            {"expr": "top_k([1,1,1,2,2,3], 2)", "expected": [1,2]},
            {"expr": "top_k([4,4,4,4], 1)", "expected": [4]},
        ],
    },

    "merge_intervals": {
        "level": 3,
        "title": "Merge Intervals",
        "description": "Объединить пересекающиеся интервалы.",
        "template": "def merge(intervals):\n    # ваш код здесь\n    pass",
        "tests": [
            {"expr": "merge([[1,3],[2,6],[8,10],[15,18]])", "expected": [[1,6],[8,10],[15,18]]},
            {"expr": "merge([[1,4],[4,5]])", "expected": [[1,5]]},
        ],
    },

    # ---------- LEVEL 4 ----------
    "lru_cache": {
        "level": 4,
        "title": "LRU Cache",
        "description": "Реализовать LRU-кэш.",
        "template": (
            "class LRUCache:\n"
            "    def __init__(self, capacity):\n"
            "        pass\n"
            "\n"
            "    def get(self, key):\n"
            "        pass\n"
            "\n"
            "    def put(self, key, value):\n"
            "        pass\n"
        ),
        "tests": [],
    },

    "trie": {
        "level": 4,
        "title": "Trie",
        "description": "Реализовать Trie.",
        "template": (
            "class Trie:\n"
            "    def __init__(self):\n"
            "        pass\n"
            "\n"
            "    def insert(self, word):\n"
            "        pass\n"
            "\n"
            "    def search(self, word):\n"
            "        pass\n"
        ),
        "tests": [],
    },
}


# -------------------------------
# API ДЛЯ БЭКЕНДА
# -------------------------------

def get_task(task_id):
    return TASKS.get(task_id)


def random_task():
    return random.choice(list(TASKS.keys()))


def random_task_by_level(level: int):
    tasks = [tid for tid, t in TASKS.items() if t["level"] == level]
    return random.choice(tasks) if tasks else None
