import React from 'react';
import { X } from 'lucide-react';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rules-modal-title"
    >
      <div className="w-full max-w-2xl max-h-[88dvh] flex flex-col rounded-2xl bg-[#faf6ee] dark:bg-[#1b2026] border border-[#d6c9b4] dark:border-[#2d3540] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e2d8c7] dark:border-[#2c3440]">
          <h2 id="rules-modal-title" className="font-display text-xl font-bold text-[#1f1a16] dark:text-[#f8fafc]">
            Правила дворового «Парчиса»
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть правила"
            className="w-10 h-10 rounded-lg bg-[#efe8dc] dark:bg-[#252c35] hover:bg-[#e5dccb] dark:hover:bg-[#2f3844] flex items-center justify-center text-[#29221c] dark:text-[#f8fafc] cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4 text-sm text-[#4a4036] dark:text-[#cbd5e1] leading-relaxed">
          <div>
            <h3 className="font-display font-bold text-amber-700 dark:text-amber-300 mb-1">
              1. Жребий, очерёдность ходов и правило обязательного полного хода
            </h3>
            <p>
              <strong>Жребий и очерёдность:</strong> перед началом партии игроки бросают по одному кубику для определения первого хода (при равенстве максимума — переброс среди лидеров). Далее очередь хода передаётся строго <strong>по часовой стрелке</strong> (Нижний → Левый → Верхний → Правый).
            </p>
            <p className="mt-1.5">
              <strong>Обязательный полный ход:</strong> если можно сыграть оба кубика — игрок обязан сыграть оба. Если сыграть оба кубика невозможно, но можно походить либо на больший кубик, либо на меньший — игрок <strong>обязан выбрать ход на больший кубик</strong> (меньший разблокируется, только если на больший вообще нет легальных ходов).
            </p>
            <p className="mt-1.5">
              <strong>Дубль:</strong> при выпадении дубля игрок <strong>всегда</strong> получает право на повторный бросок (даже если не было доступных ходов — кроме 3-го дубля подряд). При <strong>3 дублях подряд</strong> кубики подсвечиваются золотом: игрок сначала ходит выпавшими значениями, а затем выбирает любую свою фишку на поле (кроме тюрьмы и резерва) для мгновенной отправки на самую дальнюю свободную букву «ФИНИШ».
            </p>
          </div>

          <div>
            <h3 className="font-display font-bold text-amber-700 dark:text-amber-300 mb-1">
              2. Площадка «СТАРТ», клетка 14 и правило «1 клетка = 1 фишка»
            </h3>
            <p>
              <strong>Площадка «СТАРТ»</strong> используется только как стартовая база: сюда фишка заряжается из резерва за <strong>6</strong> и отсюда делает шаг на клетку <strong>1</strong> своего луча. На своём «СТАРТЕ» могут находиться несколько своих фишек (например, при дубле 6-6 можно сразу зарядить две фишки подряд). Ни одна фишка при движении по кругу никогда не заходит на «СТАРТ».
            </p>
            <p className="mt-1.5">
              <strong>Клетка 14 и правило «1 клетка = 1 фишка»:</strong> на всех остальных клетках поля (дорожки 1–14, «Домик», «Тюрьма» и буквы «ФИНИША») стоит максимум 1 фишка, перепрыгивать через фишки нельзя. При прохождении мимо чужого луча клетка <strong>14</strong> работает как обычная клетка круга: <strong>… → 12 → 13 → 14 → 1 → 2 → …</strong> На своём родном луче в конце круга с <strong>13 → 14</strong> фишка сворачивает на финиш: <strong>Ш → И → Н → И → Ф</strong>.
            </p>
          </div>

          <div>
            <h3 className="font-display font-bold text-amber-700 dark:text-amber-300 mb-1">
              3. Срезки через центр (с клетки 7)
            </h3>
            <p>
              Стоя на любой клетке 7, можно потратить: ровно <strong>1</strong> — чтобы срезать по прямой на клетку 7 следующего луча; ровно <strong>3</strong> — чтобы срезать по диагонали через центр на противоположную клетку 7 (если целевая клетка 7 не занята вашей фишкой).
            </p>
          </div>

          <div>
            <h3 className="font-display font-bold text-amber-700 dark:text-amber-300 mb-1">
              4. Домик (клетка 12) и Тюрьма (клетка 2)
            </h3>
            <p>
              <strong>Домик:</strong> как только фишка заканчивает шаг на клетке 12 (и примыкающий «Домик» пуст), она <strong>немедленно</strong> прячется в «Домик» — ещё до розыгрыша оставшегося кубика или бонусных 6 шагов при выкупе. Если после входа в «Домик» у игрока остался второй кубик, он может продолжить ход этой же фишкой из «Домика» (на 13 и далее) или походить другой фишкой.
            </p>
            <p className="mt-1.5">
              <strong>Тюрьма и иммунитет на 3 хода:</strong> фишка попадает в «Тюрьму #» только в самом конце хода игрока, если она осталась стоять на клетке 2 (после всех кубиков и перебросов за дубль) и «Тюрьма» пуста. При выходе из «Тюрьмы #» за <strong>6</strong> на клетку 2 фишка получает <strong>иммунитет от повторного попадания в тюрьму на 3 хода владельца</strong> (счётчик 3 → 2 → 1 отображается рядом с фишкой). При уходе с клетки 2 иммунитет сбрасывается; если через 3 хода фишка не ушла с 2 — она снова падает в пустую «Тюрьму». Иммунитет не защищает от съедания противником (при этом сам противник, оставшись на 2 без ходов, в конце своего хода сядет в «Тюрьму #»).
            </p>
          </div>

          <div>
            <h3 className="font-display font-bold text-amber-700 dark:text-amber-300 mb-1">
              5. Съедание, выкуп и полные 6 шагов
            </h3>
            <p>
              Встав на клетку, занятую фишкой противника (включая клетку 14, клетки 2 и 12), вы отправляете её к себе в «Пленные». Выкуп за <strong>6</strong> возвращает фишку в резерв, а игрок, у которого её выкупили, обязан пройти <strong>ровно 6 шагов одной фишкой</strong> по полю (дробить шаги нельзя; если ни одна фишка не может пройти все 6 клеток без препятствий и перелёта, бонус сгорает).
            </p>
          </div>

          <div>
            <h3 className="font-display font-bold text-amber-700 dark:text-amber-300 mb-1">
              6. Постепенный финиш и победа
            </h3>
            <p>
              Пройдя свою клетку 14, фишка заходит на <strong>Ш → И → Н → И → Ф</strong> постепенно за несколько ходов (не перепрыгивая свои фишки на финише и без перелёта). Побеждает первый, кто заведёт все 5 фишек на слово «ФИНИШ».
            </p>
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-[#e2d8c7] dark:border-[#2c3440] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 min-h-[44px] rounded-xl bg-amber-500 hover:bg-amber-400 text-[#1c140e] font-display font-bold text-sm cursor-pointer transition-colors"
          >
            Понятно
          </button>
        </div>
      </div>
    </div>
  );
};
