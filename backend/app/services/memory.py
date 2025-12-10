# app/services/memory.py

class Memory:
    def __init__(self, max_history=12):
        self.max_history = max_history
        
        # режим интервью
        self.mode = "TECH"
        
        # этап интервью
        self.stage = "intro"
        
        # уровень интервью (1=Junior, 2=Middle, 3=Senior, 4=Expert)
        self.interview_level = None
        
        # текущий уровень coding задач
        self.coding_level = 1
        
        # текущая coding задача (task_id)
        self.current_task = None
        
        # количество подсказок подряд для текущей задачи
        self.hint_count = 0
        
        # количество теоретических вопросов
        self.theory_questions_asked = 0
        
        # ---- статистика теории ----
        self.theory_total = 0
        self.theory_correct = 0
        self.theory_fail_streak = 0
        
        # ---- статистика лайвкодинга ----
        self.coding_total = 0
        self.coding_success = 0
        self.coding_fail = 0
        
        # история диалога
        self.history = []
    
    def add_user_message(self, message: str):
        """Добавить сообщение пользователя"""
        self.history.append({"role": "user", "content": message})
        self._trim()
    
    def add_assistant_message(self, message: str):
        """Добавить сообщение ассистента"""
        self.history.append({"role": "assistant", "content": message})
        self._trim()
    
    def _trim(self):
        """Ограничить историю по размеру"""
        extra = len(self.history) - self.max_history
        if extra > 0:
            self.history = self.history[extra:]
    
    def reset_full(self):
        """Полный сброс всей логики интервью"""
        self.mode = "TECH"
        self.stage = "intro"
        self.interview_level = None
        self.coding_level = 1
        self.current_task = None
        self.hint_count = 0
        self.theory_questions_asked = 0
        
        self.theory_total = 0
        self.theory_correct = 0
        self.theory_fail_streak = 0
        
        self.coding_total = 0
        self.coding_success = 0
        self.coding_fail = 0
        
        self.history = []
    
    def get_context(self):
        """Получить контекст диалога"""
        return self.history


# 🔑 ГЛОБАЛЬНЫЙ ЭКЗЕМПЛЯР - создаётся при импорте
memory = Memory()
