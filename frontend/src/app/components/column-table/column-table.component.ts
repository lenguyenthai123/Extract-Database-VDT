import {
  booleanAttribute,
  Component,
  OnInit,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms'; // Import FormsModule
import { BrowserModule } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { Column } from '../../models/column.model';
import { ColumnService } from '../../services/column/column.service';
import { DataService } from '../../services/data/data.service';
import { Table } from '../../models/table.model';
import { getUniqueElements } from '../../utils/Utils';

@Component({
  selector: 'app-column-table',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './column-table.component.html',
  styleUrl: './column-table.component.scss',
})
export class ColumnTableComponent implements OnInit {
  preRows: Column[] = [];
  rows: Column[] = [];

  typeOfDatabase: string = '';

  numberChanged: number = 0;
  changedList: [number, number][] = [];

  btnAddStatus: boolean = false;
  btnSaveStatus: boolean = true;

  alertPlaceholder: HTMLElement | null = null;
  alertTrigger: HTMLElement | null = null;
  liveToast: ElementRef | null = null;

  actionInsert: boolean = false;
  actionUpdate: boolean = false;
  actionDelete: boolean = false;

  isLoading: boolean = false;
  isDone: boolean = false;
  status: string = '';
  message: string = '';

  table: Table = new Table();

  // Danh sách các kiểu dữ liệu trong MySQL
  listDataTypes: string[] = [];
  listNumericDataTypes: string[] = [];
  listDataTypesWithoutAutoIncrement: string[] = [];

  constructor(
    private columnService: ColumnService,
    private dataService: DataService
  ) {
    if (
      this.dataService.getData('type') === 'mysql' ||
      this.dataService.getData('type') === 'mariadb'
    ) {
      this.listDataTypes = this.dataService.mysqlDataTypes;
      this.listNumericDataTypes = this.dataService.mysqlNumericDataTypes;
      this.listDataTypesWithoutAutoIncrement =
        this.dataService.mysqlDataTypesWithoutAutoIncrement;
    }
  }

  ngAfterViewInit() {
    this.alertPlaceholder = document.getElementById('liveAlertPlaceholder');
    this.alertTrigger = document.getElementById('liveAlertBtn');
  }

  ngOnInit(): void {
    this.isLoading = true;

    this.table = JSON.parse(this.dataService.getData('table'));
    console.log('Table in column component: ', this.table);
    this.dataService.events$.subscribe({
      next: (data) => {
        this.table = data;
        this.loadAllColumns();
        console.log('Data in column component: ', data);
        //Call api
      },
      error: (error) => {
        console.error(error);
      },
    });
    this.loadAllColumns();
  }

  loadAllColumns() {
    this.columnService.getList(this.table.name).subscribe({
      next: (data) => {
        this.rows = [];
        this.preRows = [];

        for (let i = 0; i < data.length; i++) {
          let column1: Column = new Column();
          let column2: Column = new Column();

          column1.set(data[i]);
          column2.set(data[i]);

          // Chuyển đổi giá trị mặc định thành số => phù hợp với kiểu dữ liệu
          this.listNumericDataTypes.forEach((type) => {
            if (column1.dataType === type) {
              column1.defaultValueType = 'number';
              column2.defaultValueType = 'number';
            }
          });

          //
          this.listDataTypesWithoutAutoIncrement.forEach((type) => {
            if (column1.dataType === type) {
              column1.disabledAutoIncrement = true;
              column2.disabledAutoIncrement = true;
            }
          });

          this.rows.push(column1);
          this.preRows.push(column2);
        }

        // Cập nhật lại id cho từng hàng
        for (let i = 0; i < this.rows.length; i++) {
          this.rows[i].id = i + 1;
        }

        this.isLoading = false;

        console.log('Data: ', data);
      },
      error: (error) => {
        this.isLoading = false;

        this.raiseAlert('Lỗi kết nối đến server', 'danger');

        console.error('There was an error!', error);
      },
    });
  }

  turnOffNotify() {
    this.isDone = false;
  }

  raiseAlert(message: string, type: string): void {
    this.message = message;
    this.status = type;
    this.isDone = true;
  }

  save() {
    // Xử lý validation
    for (let i = 0; i < this.rows.length; i++) {
      const { status, message }: { status: boolean; message: string } =
        this.columnService.isValid(this.rows[i]);

      if (!status) {
        this.raiseAlert(message, 'danger');
        return;
      }
    }

    // Variable to control
    let checkInsert: boolean = true;
    let checkUpdate: boolean = true;

    // Xử lý trường hợp Insert
    if (this.actionInsert) {
      checkInsert = true;
      // Call API.
      console.log(this.rows[0]);

      this.columnService.add(this.rows[0]).subscribe({
        next: (data) => {
          if (data === true) {
            console.log(data);

            // Xóa hàng mẫu và thêm vào cuối.
            this.rows.push(this.rows[0]);
            this.rows.splice(0, 1);

            // Enable toàn bộ row.
            this.enableAllRows();

            this.raiseAlert('Thêm cột thành công!', 'success');
            this.actionInsert = false;

            // Bật chức năng thêm và tắt chức năng save
            checkInsert = true;

            // Update old row
            this.preRows.unshift(this.rows[0]);
          } else {
            this.raiseAlert('Thêm cột thất bại', 'danger');
          }
        },
        error: (error) => {
          console.log(error.error);
          this.raiseAlert('Thêm cột thất bại', 'danger');
        },
      });
    }

    //---------------------------------------------------------

    //Xử lý trường hợp Update
    if (this.actionUpdate) {
      let changedRow: number[] = [];
      for (let i = 0; i < this.changedList.length; i++) {
        // Lấy ra từng hàng đã bị thay đổi.
        const rowId = this.changedList[i][0];
        changedRow.push(rowId);
      }
      // Rút gọn lại unique những hàng bị thay đổi.
      changedRow = getUniqueElements(changedRow);

      // Call api cho từng hàng
      let successList: number[] = [];
      let failedList: number[] = [];

      for (let i = 0; i < changedRow.length; i++) {
        console.log('Old name: ' + this.preRows[changedRow[i] - 1].name);
        console.log(this.rows[changedRow[i] - 1]);
        this.columnService
          .update(
            this.rows[changedRow[i] - 1],
            this.preRows[changedRow[i] - 1].name
          )
          .subscribe({
            next: (data) => {
              if (data === true) {
                console.log('Update ngon');
                //this.raiseAlert('Cập nhật cột thành công!', 'success');

                successList.push(changedRow[i]);
              } else {
                //this.raiseAlert('Cập nhật cột thất bại', 'danger');
                failedList.push(changedRow[i]);
                console.log('ngu ngu');
              }
            },
            error: (error) => {
              console.log(error.error);
              //this.raiseAlert('Cập nhật cột thất bại', 'danger');
              failedList.push(changedRow[i]);
            },
          });
      }
      console.log('ra day');
      let message: string = '';
      // Xử lý thông báo
      if (successList.length > 0) {
        message += 'Cập nhật cột thành công: ';
        for (let i = 0; i < successList.length; i++) {
          message += successList[i] + ', ';
        }
        message = message.slice(0, -2);
        this.raiseAlert(message, 'success');
      }

      message = '';
      if (failedList.length > 0) {
        message += 'Cập nhật cột thất bại: ';
        for (let i = 0; i < failedList.length; i++) {
          message += failedList[i] + ', ';
        }
        message = message.slice(0, -2);
        this.raiseAlert(message, 'danger');
      }
    }

    //reset numberChanged

    if (checkInsert && checkUpdate) {
      this.enableSaveAndDiscardBtn(false);
      this.numberChanged = 0;
      this.changedList = [];
    }
  }

  addRow() {
    // Assign flag insert true
    this.actionInsert = true;

    // Create new column
    let column: Column = new Column();
    column.id = this.rows.length + 1;
    this.rows.unshift(column);

    // Disable all rows except the first row
    this.disableAllRowsExcept();
    this.enableSaveAndDiscardBtn(true);
  }

  deleteRow(index: number) {
    this.columnService.detele(this.rows[index]).subscribe({
      next: (data) => {
        alert(data);
        console.log(data);

        this.rows.splice(index, 1);
        for (let i = 0; i < this.rows.length; i++) {
          this.rows[i].id = i + 1;
        }
      },
      error: (error) => {
        console.log(error);
      },
    });
  }
  disableAllRowsExcept() {
    for (let i = 1; i < this.rows.length; i++) {
      this.rows[i]['disabled'] = true;
    }
  }
  enableAllRows() {
    this.rows.forEach((row) => {
      row['disabled'] = false;
    });
  }

  onFieldChange(event: string, rowId: number, fieldId: number) {
    let check: boolean = false;

    if (fieldId === 5) {
      if (event === 'true') {
        let check: boolean = false;
        for (let i = 0; i < this.rows.length; i++) {
          if (this.rows[i].primaryKey && i != rowId - 1) {
            check = true;
            break;
          }
        }

        if (check) {
          this.raiseAlert(
            'Hãy bỏ primary key ban đầu để tiến hàng chọn primary key mới',
            'danger'
          );
          this.rows[rowId - 1].primaryKey = false;

          return;
        }
      }
    }

    if (fieldId === 2) {
      // Chuyển đổi giá trị mặc định thành số => phù hợp với kiểu dữ liệu
      let check: boolean = false;

      this.listNumericDataTypes.forEach((type) => {
        if (event === type) {
          this.rows[rowId - 1].defaultValueType = 'number';
          this.rows[rowId - 1].defaultValue = '0';
          check = true;
        }
      });
      if (!check) {
        this.rows[rowId - 1].defaultValueType = 'text';
      }

      // Disable auto increment
      check = false;
      this.listDataTypesWithoutAutoIncrement.forEach((type) => {
        if (event === type) {
          this.rows[rowId - 1].disabledAutoIncrement = true;
          check = true;
        }
      });
      if (!check) {
        this.rows[rowId - 1].disabledAutoIncrement = false;
      }
    }

    for (let i = 0; i < this.changedList.length; i++) {
      {
        if (
          this.changedList[i][0] == rowId &&
          this.changedList[i][1] == fieldId
        ) {
          check = true;
          break;
        }
      }
    }

    if (!check) {
      this.actionUpdate = true;
      this.enableSaveAndDiscardBtn(true);
      this.changedList.push([rowId, fieldId]);
      this.numberChanged++;
    }
  }
  updateChanged(rowId: number) {
    let check: boolean = false;
    for (let i = this.changedList.length - 1; i >= 0; i--) {
      {
        if (this.changedList[i][0] == rowId) {
          check = true;
          this.changedList.splice(i, 1);
          this.numberChanged--;
        }
      }
    }
    if (check && this.numberChanged == 0) {
      this.enableSaveAndDiscardBtn(false);
    }
  }

  discardChanged() {
    for (let i = 0; i < this.preRows.length; i++) {
      this.rows[i].set(this.preRows[i]);
    }
    this.enableSaveAndDiscardBtn(false);
    this.numberChanged = 0;
    this.changedList = [];
  }

  enableSaveAndDiscardBtn(flag: boolean) {
    this.btnSaveStatus = !flag;
    this.btnAddStatus = flag;
  }

  primaryKeyCondition(rowId: number): boolean {
    let check: boolean = false;
    for (let i = 0; i < this.rows.length; i++) {
      if (this.rows[i].primaryKey) {
        check = true;
        break;
      }
    }
    if (check) {
      if (this.rows[rowId].primaryKey) {
        return false;
      }
      return true;
    }
    return false;
  }
}
