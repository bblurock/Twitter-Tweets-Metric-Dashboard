class Dashing.Accumshared extends Dashing.Widget
  oriData: {}

  createChart: (seriesOptions) ->
    $('#accumshared').highcharts 'StockChart',
      title: text: 'Accumlated Shared Count'
      legend: enabled: true
      rangeSelector:
        selected: 4
        allButtonsEnabled: true
        enable: true
      legend: enabled: true
      yAxis:
        plotLines: [ {
          value: 0
          width: 1
          color: 'silver'
        } ]
        min: 0
      plotOptions:
        series:
          lineWidth: 1
          events: legendItemClick: (event) ->
            index = @index

            # toggle current graph
            if @visible then @.hide() else @.show()

            # Renew local storage
            localStorage.setItem(@name, (if @visible then 'true' else 'false'))

            # Sync every graph
            chart = $('#mentioned, #shared, #retweeted, #followers, #favorited, #accumshared, #accummentioned')
            chart.each ->
              c = $(@).highcharts()
              if c.series[index].visible then c.series[index].hide() else c.series[index].show()
              return
        spline:
          marker:
            enabled: true
      
      tooltip:
        pointFormat: '<span style="color:{series.color}">{series.name}</span>: {point.y}<br/>'
        valueDecimals: 0
      series: seriesOptions
    return

  ready: ->
    that = this
    console.log 'ready'

    $('#accumsetting select').on 'change', ->
      localStorage.setItem('accumsetting', $(this).val())
      console.log $(this).val()
      that.redraw()

  redraw: ()->

    legendDefault = {
      "tickleapp": true,
      "wonderworkshop": false,
      "spheroedu": false,
      "gotynker": false,
      "hopscotch": false,
      "codehs": false,
      "kodable": false,
      "codeorg": false,
      "scratch": false,
      "trinketapp": false
    }

    data = $.extend(true,{},@oriData);

    console.log 'in redraw'
    console.log @oriData

    accum = localStorage.getItem('accumsetting') || 30;

    for key of data
      i = data[key].data.length - 1

      while i - accum >= 0
        result = 0
        j = 0

        while j < accum
          result += data[key].data[i - j][1]
          j++
        data[key].data[i][1] = result
        i--

    for key of data
      storageVisibility = localStorage.getItem(data[key].name)
      if storageVisibility
        data[key].visible = if storageVisibility == 'true' then true else false
      else
        data[key].visible = legendDefault[data[key].name]

    console.log 'after sort'
    console.log data

    result = []

    for key of data
      result.push data[key]

    @createChart(result)

  onData: (data) ->
    data = JSON.parse(data.data)
    @oriData = $.extend(true, {}, data);

    @redraw()
